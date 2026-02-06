#!/usr/bin/env python3
"""
온톨로지 구조 검증기 v1.1

온톨로지 기반 지식그래프(knowledge_graph_ontology.json)를 로드하여
그래프 구조(노드 타입, 필수 속성, 프로세스 순서, 규제 관계 등)를 검증한다.
"""

import json
import time
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime

from ontology import (
    get_all_subclasses,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 데이터 구조
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Node:
    id: str
    labels: List[str]
    types: List[str]  # @type 온톨로지 클래스
    properties: Dict

@dataclass
class Edge:
    source: str
    target: str
    rel_type: str

@dataclass
class ValidationResult:
    name: str
    passed: bool
    score: float  # 0.0 ~ 1.0
    details: str
    found_count: int = 0
    expected_count: int = 0


# ═══════════════════════════════════════════════════════════════════════════════
# 온톨로지 그래프 로더
# ═══════════════════════════════════════════════════════════════════════════════

class OntologyGraph:
    """온톨로지 메타데이터를 포함하는 그래프"""

    def __init__(self, path: str = "data/knowledge-graph-ontology.json"):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        self.adj: Dict[str, List[Edge]] = {}       # source → edges
        self.rev_adj: Dict[str, List[Edge]] = {}    # target → edges
        self.taxonomy = {}
        self.load(path)

    def load(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.taxonomy = data.get("taxonomy", {})

        for node_data in data.get("graph_data", {}).get("nodes", []):
            node = Node(
                id=node_data["id"],
                labels=node_data.get("labels", []),
                types=node_data.get("@type", []),
                properties=node_data.get("properties", {}),
            )
            self.nodes[node.id] = node

        for edge_data in data.get("graph_data", {}).get("edges", []):
            edge = Edge(
                source=edge_data["source"],
                target=edge_data["target"],
                rel_type=edge_data["type"],
            )
            self.edges.append(edge)
            self.adj.setdefault(edge.source, []).append(edge)
            self.rev_adj.setdefault(edge.target, []).append(edge)

        print(f"  로드: {len(self.nodes)}개 노드, {len(self.edges)}개 엣지")

    # ── 질의 메서드 ──

    def nodes_by_label(self, label: str) -> List[Node]:
        """특정 레이블을 가진 노드 반환"""
        return [n for n in self.nodes.values() if label in n.labels]

    def nodes_by_type(self, ontology_class: str) -> List[Node]:
        """특정 온톨로지 클래스(@type)를 가진 노드 반환"""
        return [n for n in self.nodes.values() if ontology_class in n.types]

    def nodes_by_type_hierarchy(self, ontology_class: str) -> List[Node]:
        """온톨로지 클래스 + 모든 하위 클래스에 해당하는 노드 반환"""
        target_classes = {ontology_class}
        subclasses = get_all_subclasses(ontology_class)
        target_classes.update(subclasses)

        return [
            n for n in self.nodes.values()
            if any(t in target_classes for t in n.types)
        ]

    def outgoing(self, node_id: str, rel_type: str = None) -> List[Edge]:
        """나가는 엣지 (필터 가능)"""
        edges = self.adj.get(node_id, [])
        if rel_type:
            return [e for e in edges if e.rel_type == rel_type]
        return edges

    def incoming(self, node_id: str, rel_type: str = None) -> List[Edge]:
        """들어오는 엣지 (필터 가능)"""
        edges = self.rev_adj.get(node_id, [])
        if rel_type:
            return [e for e in edges if e.rel_type == rel_type]
        return edges

    def documents(self) -> List[Node]:
        """문서 노드만 반환"""
        return self.nodes_by_label("Document")

    def processes(self) -> List[Node]:
        """프로세스 노드만 반환"""
        return self.nodes_by_label("Process")

    def concepts(self) -> List[Node]:
        """개념 노드만 반환"""
        return self.nodes_by_label("Concept")

    def regulations(self) -> List[Node]:
        """규제 노드만 반환"""
        return self.nodes_by_label("Regulation")


# ═══════════════════════════════════════════════════════════════════════════════
# 검증 시나리오
# ═══════════════════════════════════════════════════════════════════════════════

def validate_graph_structure(g: OntologyGraph) -> List[ValidationResult]:
    """그래프 구조 기본 검증"""
    results = []

    # 1. 노드에 @type 존재 확인
    typed_nodes = sum(1 for n in g.nodes.values() if n.types)
    total = len(g.nodes)
    ratio = typed_nodes / total if total > 0 else 0
    results.append(ValidationResult(
        name="노드 @type 커버리지",
        passed=ratio >= 0.9,
        score=ratio,
        details=f"{typed_nodes}/{total} 노드에 @type 존재",
        found_count=typed_nodes,
        expected_count=total,
    ))

    # 2. 문서 노드에 필수 속성 존재
    docs = g.documents()
    complete = sum(1 for d in docs if all(
        d.properties.get(k) for k in ["name", "carrier", "doc_type", "tier"]
    ))
    ratio = complete / len(docs) if docs else 0
    results.append(ValidationResult(
        name="문서 필수 속성 완전성",
        passed=ratio >= 0.95,
        score=ratio,
        details=f"{complete}/{len(docs)} 문서에 필수 속성 존재",
        found_count=complete,
        expected_count=len(docs),
    ))

    # 3. 프로세스 순서(PRECEDES) 체인 존재
    process_edges = [e for e in g.edges if e.rel_type == "PRECEDES"]
    results.append(ValidationResult(
        name="프로세스 순서 관계",
        passed=len(process_edges) >= 6,
        score=min(len(process_edges) / 7, 1.0),
        details=f"{len(process_edges)}개 PRECEDES 엣지",
        found_count=len(process_edges),
        expected_count=7,
    ))

    # 4. 규제 노드 존재 + GOVERNS/RESTRICTS 엣지
    regs = g.regulations()
    governs = sum(1 for e in g.edges if e.rel_type == "GOVERNS")
    restricts = sum(1 for e in g.edges if e.rel_type == "RESTRICTS")
    results.append(ValidationResult(
        name="규제 관계 존재",
        passed=len(regs) > 0 and governs > 0 and restricts > 0,
        score=min((governs + restricts) / 4, 1.0),
        details=f"규제 {len(regs)}개, GOVERNS {governs}개, RESTRICTS {restricts}개",
        found_count=governs + restricts,
        expected_count=4,
    ))

    # 5. 개념 노드 + 관계 존재
    concepts = g.concepts()
    concept_edges = sum(1 for e in g.edges if e.rel_type in ("BROADER", "NARROWER", "EXPLAINS", "RELATED_TO", "ANTONYM_OF"))
    results.append(ValidationResult(
        name="개념 그래프 존재",
        passed=len(concepts) >= 10 and concept_edges >= 10,
        score=min(len(concepts) / 20, 1.0),
        details=f"개념 {len(concepts)}개, 개념관계 {concept_edges}개",
        found_count=len(concepts),
        expected_count=20,
    ))

    # 6. USED_IN 엣지 (문서→프로세스)
    used_in = sum(1 for e in g.edges if e.rel_type == "USED_IN")
    results.append(ValidationResult(
        name="문서-프로세스 연결",
        passed=used_in >= 50,
        score=min(used_in / 100, 1.0),
        details=f"{used_in}개 USED_IN 엣지",
        found_count=used_in,
        expected_count=100,
    ))

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("온톨로지 구조 검증기 v1.1")
    print("=" * 70)

    start_time = time.time()

    # 그래프 로드
    print("\n[1/2] 온톨로지 그래프 로드")
    try:
        g = OntologyGraph("data/knowledge-graph-ontology.json")
    except FileNotFoundError:
        print("  data/knowledge-graph-ontology.json을 찾을 수 없습니다.")
        print("  먼저 simulator_ontology.py를 실행하세요.")
        return 1

    # 구조 검증
    print("\n[2/2] 그래프 구조 검증")
    print("-" * 70)
    all_results = validate_graph_structure(g)
    for vr in all_results:
        status = "PASS" if vr.passed else "FAIL"
        print(f"  [{status}] {vr.name}: {vr.score:.0%} ({vr.details})")

    # 종합 요약
    total_pass = sum(1 for r in all_results if r.passed)
    total_count = len(all_results)
    avg_score = sum(r.score for r in all_results) / total_count if total_count else 0
    elapsed = time.time() - start_time

    print(f"\n{'=' * 70}")
    print("종합 결과")
    print(f"{'=' * 70}")
    print(f"  통과: {total_pass}/{total_count} ({total_pass/total_count:.0%})")
    print(f"  평균 점수: {avg_score:.0%}")
    print(f"  소요시간: {elapsed:.2f}초")

    # 결과 파일 저장
    output = {
        "timestamp": datetime.now().isoformat(),
        "version": "1.1-structure",
        "graph_stats": {
            "nodes": len(g.nodes),
            "edges": len(g.edges),
            "documents": len(g.documents()),
            "concepts": len(g.concepts()),
            "processes": len(g.processes()),
            "regulations": len(g.regulations()),
        },
        "validation": {
            "total_tests": total_count,
            "passed": total_pass,
            "pass_rate": f"{total_pass/total_count:.0%}",
            "avg_score": f"{avg_score:.2f}",
        },
        "results": [
            {
                "name": r.name,
                "passed": r.passed,
                "score": round(r.score, 3),
                "details": r.details,
            }
            for r in all_results
        ],
    }

    output_path = "docs/results/ontology-validation.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n  결과 저장: {output_path}")

    # 실패 항목 안내
    failed = [r for r in all_results if not r.passed]
    if failed:
        print(f"\n  개선 필요 ({len(failed)}건):")
        for r in failed:
            print(f"    - {r.name}: {r.details}")

    return 0 if total_pass == total_count else 1


if __name__ == "__main__":
    exit(main())
