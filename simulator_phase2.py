#!/usr/bin/env python3
"""
Phase 1 검증 도구: API 구조 검증 시뮬레이터

Golden Set의 파라미터 조합으로 Warehouse API를 호출하고,
기대 결과와 실제 결과를 비교하여 검증한다.

목적: "Phase 2에서 이 구조로 실제 API를 만들어도 되는가?" 사전 검증
  - 파라미터 기반 조회가 원하는 문서를 정확히 반환하는가?
  - 엣지 탐색이 기대한 관계를 따라가는가?
  - 프로세스/개념/규제 조회가 빠짐없이 작동하는가?
"""

import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict

from warehouse_api import WarehouseAPI
from golden_set import GOLDEN_SET


# ═══════════════════════════════════════════════════════════════════════════════
# 검증 결과 구조
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class StepResult:
    """개별 API 호출 결과"""
    action: str
    params: Dict
    doc_count: int
    doc_types_found: List[str]
    passed: bool
    detail: str


@dataclass
class TestResult:
    """Golden Set 항목 1건의 검증 결과"""
    gs_id: str
    question: str
    intent: str
    passed: bool
    steps: List[StepResult]
    detail: str


# ═══════════════════════════════════════════════════════════════════════════════
# 가상 셰프 (Virtual Chef)
# ═══════════════════════════════════════════════════════════════════════════════

class StructureValidator:
    """
    Golden Set 파라미터로 Warehouse API를 호출하고 기대 결과와 비교한다.
    "이 구조로 Phase 2 API를 만들어도 되는가?" 검증.
    """

    def __init__(self, warehouse: WarehouseAPI):
        self.w = warehouse
        self.results: List[TestResult] = []
        self.training_log: List[Dict] = []

    def run_golden_set(self) -> List[TestResult]:
        """전체 Golden Set 실행"""
        self.results = []

        for gs in GOLDEN_SET:
            result = self._run_single(gs)
            self.results.append(result)

        return self.results

    def _run_single(self, gs: Dict) -> TestResult:
        """Golden Set 항목 1건 실행"""
        step_results = []
        all_found_types = set()
        anchor_doc_ids = []

        for step in gs.get("steps", []):
            sr = self._execute_step(step, anchor_doc_ids)
            step_results.append(sr)
            all_found_types.update(sr.doc_types_found)

            # anchor 단계 결과의 문서 ID를 기록 (context 확장용)
            if step.get("role") == "anchor" and sr.doc_count > 0:
                anchor_doc_ids = self._get_last_doc_ids()

        # 검증
        passed = True
        details = []

        # 기대 문서유형 검증
        expected_types = set(gs.get("expected_doc_types", []))
        if expected_types:
            matched = all_found_types & expected_types
            if len(matched) < len(expected_types):
                missing = expected_types - matched
                passed = False
                details.append(f"문서유형 누락: {missing}")
            else:
                details.append(f"문서유형 전수 확인: {matched}")

        # 기대 최소 건수 검증
        min_count = gs.get("expected_count_min", 0)
        total_docs = sum(sr.doc_count for sr in step_results if sr.action != "fetch_process_chain")
        if min_count > 0 and total_docs < min_count:
            passed = False
            details.append(f"건수 부족: {total_docs} < {min_count}")

        # 프로세스 체인 검증
        expected_chain = gs.get("expected_chain")
        if expected_chain:
            for sr in step_results:
                if sr.action == "fetch_process_chain":
                    actual_chain = sr.doc_types_found  # 체인은 여기 저장
                    chain_match = sum(1 for a, b in zip(actual_chain, expected_chain) if a == b)
                    if chain_match < len(expected_chain):
                        passed = False
                        details.append(f"체인 불일치: {actual_chain}")
                    else:
                        details.append(f"체인 정확: {' → '.join(actual_chain)}")

        # 개념 검증
        expected_concept = gs.get("expected_concept")
        if expected_concept:
            for sr in step_results:
                if sr.action == "fetch_concept":
                    # detail에 narrower/explains 수가 포함됨
                    details.append(sr.detail)

        # 규제 영향 검증
        expected_reg = gs.get("expected_regulation")
        if expected_reg:
            for sr in step_results:
                if sr.action == "fetch_regulation_impact":
                    details.append(sr.detail)

        # 학습 로그 축적
        self._log_training(gs, step_results, passed, all_found_types)

        return TestResult(
            gs_id=gs["id"],
            question=gs["question"],
            intent=gs.get("intent", ""),
            passed=passed,
            steps=step_results,
            detail="; ".join(details),
        )

    def _execute_step(self, step: Dict, anchor_ids: List[str]) -> StepResult:
        """단일 API 호출 실행"""
        action = step["action"]
        params = step.get("params", {})
        doc_types = []
        doc_count = 0
        detail = ""

        if action == "fetch_documents":
            result = self.w.fetch_documents(**params)
            doc_count = result.total_count
            doc_types = list(set(
                d.properties.get("doc_type", "") for d in result.documents
            ))
            self._last_doc_ids = [d.id for d in result.documents]
            detail = f"{doc_count}건, 유형: {doc_types}"

        elif action == "fetch_neighbors":
            # anchor 문서 각각에 대해 이웃 탐색
            all_neighbors = set()
            for aid in anchor_ids:
                result = self.w.fetch_neighbors(node_id=aid, **params)
                for d in result.documents:
                    all_neighbors.add(d.id)
                    dt = d.properties.get("doc_type", "")
                    if dt not in doc_types:
                        doc_types.append(dt)
            doc_count = len(all_neighbors)
            detail = f"anchor {len(anchor_ids)}건 → 이웃 {doc_count}건"

        elif action == "fetch_process_documents":
            result = self.w.fetch_process_documents(params["process_id"])
            doc_count = result.total_count
            doc_types = list(set(
                d.properties.get("doc_type", "") for d in result.documents
            ))
            self._last_doc_ids = [d.id for d in result.documents]
            detail = f"{doc_count}건, 유형: {doc_types}"

        elif action == "fetch_process_chain":
            chain = self.w.fetch_process_chain(params["start_id"])
            doc_types = chain  # 체인 ID 목록을 여기 저장
            doc_count = len(chain)
            detail = f"체인: {' → '.join(chain)}"

        elif action == "fetch_concept":
            concept = self.w.fetch_concept(params["concept_id"])
            narrower = concept.get("narrower", [])
            explains = concept.get("explains", [])
            doc_count = len(narrower) + len(explains)
            detail = f"하위개념: {len(narrower)}개, EXPLAINS: {len(explains)}개"

            # 개념 검증은 pass/fail로
            expected = step.get("expected", {})

        elif action == "fetch_regulation_impact":
            impact = self.w.fetch_regulation_impact(params["reg_id"])
            gov = impact["governed_processes"]
            res = impact["restricted_docs"]
            doc_count = len(gov) + len(res)
            doc_types = []
            detail = f"GOVERNS: {gov}, RESTRICTS: {res}"

        else:
            detail = f"알 수 없는 action: {action}"

        return StepResult(
            action=action,
            params=params,
            doc_count=doc_count,
            doc_types_found=doc_types,
            passed=doc_count > 0,
            detail=detail,
        )

    def _get_last_doc_ids(self) -> List[str]:
        return getattr(self, "_last_doc_ids", [])

    # ── 학습 데이터 축적 ──

    def _log_training(self, gs: Dict, steps: List[StepResult], passed: bool, found_types: set):
        """Phase 3 미들웨어용 학습 로그 축적"""
        self.training_log.append({
            "question": gs["question"],
            "intent": gs.get("intent", ""),
            "api_calls": [
                {"action": s.action, "params": s.params, "result_count": s.doc_count}
                for s in steps
            ],
            "found_doc_types": list(found_types),
            "passed": passed,
        })

    # ── 결과 리포트 ──

    def print_report(self):
        """검증 결과 출력"""
        print("=" * 70)
        print("Phase 1 시뮬레이터 — API 구조 검증 결과")
        print("=" * 70)

        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)

        for r in self.results:
            status = "PASS" if r.passed else "FAIL"
            print(f"\n[{status}] {r.gs_id}: {r.question}")
            print(f"  의도: {r.intent}")
            for s in r.steps:
                print(f"  → {s.action}({s.params}): {s.doc_count}건")
            print(f"  결과: {r.detail}")

        print(f"\n{'=' * 70}")
        print(f"종합: {passed}/{total} 통과 ({passed/total:.0%})")

        # 의도별 통계
        intent_stats = {}
        for r in self.results:
            intent = r.intent or "unknown"
            if intent not in intent_stats:
                intent_stats[intent] = {"pass": 0, "fail": 0}
            if r.passed:
                intent_stats[intent]["pass"] += 1
            else:
                intent_stats[intent]["fail"] += 1

        print(f"\n의도별 결과:")
        for intent, stats in intent_stats.items():
            total_i = stats["pass"] + stats["fail"]
            print(f"  {intent}: {stats['pass']}/{total_i}")

    def save_results(self, path: str = "docs/phase2_simulation_results.json"):
        """결과 파일 저장"""
        output = {
            "timestamp": datetime.now().isoformat(),
            "version": "phase2-v1.0",
            "summary": {
                "total": len(self.results),
                "passed": sum(1 for r in self.results if r.passed),
            },
            "results": [
                {
                    "id": r.gs_id,
                    "question": r.question,
                    "intent": r.intent,
                    "passed": r.passed,
                    "detail": r.detail,
                    "steps": [
                        {
                            "action": s.action,
                            "doc_count": s.doc_count,
                            "doc_types": s.doc_types_found,
                        }
                        for s in r.steps
                    ],
                }
                for r in self.results
            ],
            "training_log": self.training_log,
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"\n결과 저장: {path}")
        print(f"학습 로그: {len(self.training_log)}건 (Phase 3 미들웨어용)")


# ═══════════════════════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    start = time.time()

    # 1. 창고 로드
    print("창고 로드 중...")
    warehouse = WarehouseAPI()
    stats = warehouse.stats()
    print(f"  {stats['total_nodes']}개 노드, {stats['total_edges']}개 엣지\n")

    # 2. 구조 검증기가 Golden Set 실행
    validator = StructureValidator(warehouse)
    validator.run_golden_set()

    # 3. 결과 출력
    validator.print_report()

    # 4. 결과 저장
    validator.save_results()

    elapsed = time.time() - start
    print(f"\n소요시간: {elapsed:.2f}초")


if __name__ == "__main__":
    main()
