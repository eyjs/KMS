"""
KMS v3.0 프레임워크 검증기

프레임워크가 강제하는 규칙이 실제 데이터에서 지켜지는지 검증한다.
도메인 전문가가 어떤 문서를 만들든, 이 틀은 깨지면 안 된다.
"""

import json
import os
from datetime import datetime
from typing import List, Tuple
from taxonomy import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DATA_TIERS, CERTIFICATIONS, GA_TYPES, REGULATION_TIMELINE,
    SYSTEM_CONFIG, BUSINESSES, DOMAINS, DOC_TYPE_DOMAIN_MAP,
    get_taxonomy_stats
)


class FrameworkVerifier:
    """프레임워크 강제 규칙 검증기"""

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.graph_path = os.path.join(base_path, "data", "knowledge-graph.json")
        self.samples_path = os.path.join(base_path, "data", "samples")
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.graph_data = None
        self.nodes = []
        self.edges = []
        self.doc_nodes = []

    def load_graph(self) -> bool:
        try:
            with open(self.graph_path, "r", encoding="utf-8") as f:
                self.graph_data = json.load(f)
            self.nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
            self.edges = self.graph_data.get("graph_data", {}).get("edges", [])
            self.doc_nodes = [n for n in self.nodes if "Document" in n.get("labels", [])]
            return True
        except Exception as e:
            self.errors.append(f"그래프 로드 실패: {e}")
            return False

    # ──────────────────────────────────────────────────────────
    # 1. 분류체계 완전성
    # ──────────────────────────────────────────────────────────

    def verify_taxonomy(self) -> Tuple[int, int]:
        """분류체계 마스터 데이터가 빠짐없이 정의되어 있는지"""
        print("\n[1/8] 분류체계 완전성 검증...")
        passed, failed = 0, 0

        # 모든 DOC_TYPE이 DATA_TIERS에 등록
        all_tier_docs = set()
        for tier, config in DATA_TIERS.items():
            all_tier_docs.update(config.get("doc_types", []))

        for doc_type_id in DOC_TYPES.keys():
            if doc_type_id not in all_tier_docs:
                self.errors.append(f"문서유형 {doc_type_id}: DATA_TIERS에 미등록")
                failed += 1
            else:
                passed += 1

        # 모든 DOC_TYPE이 DOC_TYPE_DOMAIN_MAP에 등록
        for doc_type_id in DOC_TYPES.keys():
            if doc_type_id not in DOC_TYPE_DOMAIN_MAP:
                self.errors.append(f"문서유형 {doc_type_id}: DOC_TYPE_DOMAIN_MAP에 미등록")
                failed += 1
            else:
                passed += 1

        # DOC_TYPE_DOMAIN_MAP의 도메인이 DOMAINS에 존재
        for doc_type_id, domain_id in DOC_TYPE_DOMAIN_MAP.items():
            if domain_id not in DOMAINS:
                self.errors.append(f"DOC_TYPE_DOMAIN_MAP[{doc_type_id}] → {domain_id}: DOMAINS에 미등록")
                failed += 1
            else:
                passed += 1

        stats = get_taxonomy_stats()
        print(f"  ✓ 보험사: {stats['carriers']['total']}개 (생보 {stats['carriers']['life']}, 손보 {stats['carriers']['non_life']})")
        print(f"  ✓ 상품: {stats['products']['total']}개")
        print(f"  ✓ 문서유형: {stats['doc_types']['total']}개 (HOT {stats['doc_types']['hot']}, WARM {stats['doc_types']['warm']}, COLD {stats['doc_types']['cold']})")
        print(f"  ✓ 도메인: {stats['domains']}개")
        print(f"  ✓ 프로세스: {stats['processes']}개")
        print(f"  ✓ 역할: {stats['audiences']}개")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 2. 그래프 무결성
    # ──────────────────────────────────────────────────────────

    def verify_graph_integrity(self) -> Tuple[int, int]:
        """노드 중복 없음, 엣지 양 끝이 존재"""
        print("\n[2/8] 그래프 무결성 검증...")
        passed, failed = 0, 0

        node_ids = set()
        for node in self.nodes:
            node_id = node.get("id")
            if node_id in node_ids:
                self.errors.append(f"중복 노드: {node_id}")
                failed += 1
            else:
                node_ids.add(node_id)
                passed += 1

        for edge in self.edges:
            src, tgt = edge.get("source"), edge.get("target")
            if src not in node_ids:
                self.errors.append(f"엣지 소스 없음: {src}")
                failed += 1
            elif tgt not in node_ids:
                self.errors.append(f"엣지 타겟 없음: {tgt}")
                failed += 1
            else:
                passed += 1

        print(f"  ✓ 노드: {len(self.nodes)}개 (문서 {len(self.doc_nodes)}개)")
        print(f"  ✓ 엣지: {len(self.edges)}개")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 3. 프레임워크 강제: 필수 필드
    # ──────────────────────────────────────────────────────────

    def verify_required_fields(self) -> Tuple[int, int]:
        """모든 문서에 시스템 필수 필드가 존재하는지 (프레임워크 강제)"""
        print("\n[3/8] 프레임워크 필수 필드 검증...")
        passed, failed = 0, 0

        required_system = ["domain", "lifecycle", "version"]
        required_dates = ["createdAt", "updatedAt"]

        for doc in self.doc_nodes:
            props = doc.get("properties", {})
            doc_id = doc.get("id", "?")

            # 시스템 필드
            for field in required_system:
                if field not in props or props[field] is None:
                    self.errors.append(f"{doc_id}: 필수 필드 누락 '{field}'")
                    failed += 1
                else:
                    passed += 1

            # 날짜 필드
            for field in required_dates:
                if field not in props or not props[field]:
                    self.errors.append(f"{doc_id}: 필수 날짜 누락 '{field}'")
                    failed += 1
                else:
                    passed += 1

            # classification 객체 존재
            cls = props.get("classification", {})
            if not cls or "docType" not in cls:
                self.errors.append(f"{doc_id}: classification.docType 누락")
                failed += 1
            else:
                passed += 1

        print(f"  ✓ {len(self.doc_nodes)}개 문서 × {len(required_system) + len(required_dates) + 1}개 필드 검증")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 4. 프레임워크 강제: 라이프사이클 상태
    # ──────────────────────────────────────────────────────────

    def verify_lifecycle(self) -> Tuple[int, int]:
        """라이프사이클 값이 허용된 상태 중 하나인지"""
        print("\n[4/8] 라이프사이클 상태 검증...")
        passed, failed = 0, 0

        valid_states = set(SYSTEM_CONFIG["lifecycle_states"])
        state_count = {}

        for doc in self.doc_nodes:
            lc = doc.get("properties", {}).get("lifecycle", "")
            state_count[lc] = state_count.get(lc, 0) + 1

            if lc not in valid_states:
                self.errors.append(f"{doc['id']}: 잘못된 라이프사이클 '{lc}'")
                failed += 1
            else:
                passed += 1

        for state, count in sorted(state_count.items(), key=lambda x: -x[1]):
            pct = count / len(self.doc_nodes) * 100 if self.doc_nodes else 0
            print(f"  ✓ {state}: {count}건 ({pct:.1f}%)")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 5. 프레임워크 강제: SSOT (유니크 제약)
    # ──────────────────────────────────────────────────────────

    def verify_ssot(self) -> Tuple[int, int]:
        """같은 분류 경로에 ACTIVE 문서가 2개 이상이면 SSOT 위반"""
        print("\n[5/8] SSOT 유니크 제약 검증...")
        passed, failed = 0, 0

        # 도메인별 SSOT 키 구성
        active_paths = {}  # {(domain, key_tuple): [doc_ids]}

        for doc in self.doc_nodes:
            props = doc.get("properties", {})
            lifecycle = props.get("lifecycle", "")
            if lifecycle != "ACTIVE":
                continue

            domain_id = props.get("domain", "")
            domain_def = DOMAINS.get(domain_id)
            if not domain_def:
                continue

            cls = props.get("classification", {})
            ssot_key = domain_def.get("ssotKey", [])

            # SSOT 키로 경로 생성
            key_values = tuple(cls.get(k, "") for k in ssot_key)
            path = (domain_id, key_values)

            if path not in active_paths:
                active_paths[path] = []
            active_paths[path].append(doc.get("id"))

        violations = 0
        for path, doc_ids in active_paths.items():
            if len(doc_ids) > 1:
                self.errors.append(f"SSOT 위반: {path[0]} {path[1]} → ACTIVE {len(doc_ids)}건: {doc_ids[:3]}")
                violations += 1
                failed += len(doc_ids)
            else:
                passed += 1

        print(f"  ✓ ACTIVE 유니크 경로: {len(active_paths)}개")
        if violations:
            print(f"  ✗ SSOT 위반: {violations}건")
        else:
            print(f"  ✓ SSOT 위반 없음")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 6. 프레임워크 강제: 도메인 귀속
    # ──────────────────────────────────────────────────────────

    def verify_domain_assignment(self) -> Tuple[int, int]:
        """문서의 domain이 DOMAINS에 존재하고, docType과 매칭되는지"""
        print("\n[6/8] 도메인 귀속 검증...")
        passed, failed = 0, 0

        for doc in self.doc_nodes:
            props = doc.get("properties", {})
            doc_id = doc.get("id", "?")
            domain = props.get("domain", "")
            cls = props.get("classification", {})
            doc_type = cls.get("docType", "")

            # domain이 DOMAINS에 존재
            if domain not in DOMAINS:
                self.errors.append(f"{doc_id}: 잘못된 도메인 '{domain}'")
                failed += 1
                continue

            # docType의 기본 도메인과 일치 확인
            expected_domain = DOC_TYPE_DOMAIN_MAP.get(doc_type, "")
            if expected_domain and domain != expected_domain:
                self.warnings.append(f"{doc_id}: 도메인 불일치 (실제: {domain}, 기대: {expected_domain})")

            # 도메인의 필수 facet이 classification에 존재
            domain_def = DOMAINS[domain]
            allowed_facets = {f["id"] for f in domain_def.get("facets", [])}
            for facet in domain_def.get("facets", []):
                if facet.get("required") and not cls.get(facet["id"]):
                    self.errors.append(f"{doc_id}: 도메인 {domain}의 필수 facet '{facet['id']}' 누락")
                    failed += 1
                else:
                    passed += 1

            # classification에 도메인 facets에 없는 필드가 있으면 오류
            for field in cls:
                if field not in allowed_facets:
                    self.errors.append(f"{doc_id}: 도메인 {domain}에 정의되지 않은 classification 필드 '{field}'")
                    failed += 1

        domain_dist = {}
        for doc in self.doc_nodes:
            d = doc.get("properties", {}).get("domain", "?")
            domain_dist[d] = domain_dist.get(d, 0) + 1

        for domain, count in sorted(domain_dist.items(), key=lambda x: -x[1]):
            print(f"  ✓ {domain}: {count}건")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 7. 프레임워크 강제: 관계 scope 규칙
    # ──────────────────────────────────────────────────────────

    def verify_relationship_scope(self) -> Tuple[int, int]:
        """same_domain 관계가 실제로 같은 도메인 내에서만 연결되는지"""
        print("\n[7/8] 관계 scope 규칙 검증...")
        passed, failed = 0, 0

        rel_types = SYSTEM_CONFIG.get("relationship_types", {})
        node_map = {n["id"]: n for n in self.nodes}

        for edge in self.edges:
            edge_type = edge.get("type", "")
            rel_def = rel_types.get(edge_type)
            if not rel_def:
                passed += 1  # 시스템 관계가 아닌 것 (HAS_CARRIER 등)
                continue

            scope = rel_def.get("scope", "")
            if scope != "same_domain":
                passed += 1
                continue

            # same_domain 규칙: 양 끝의 carrier+product가 같아야 함
            src_node = node_map.get(edge["source"], {})
            tgt_node = node_map.get(edge["target"], {})

            src_cls = src_node.get("properties", {}).get("classification", {})
            tgt_cls = tgt_node.get("properties", {}).get("classification", {})

            src_domain = (src_cls.get("carrier", ""), src_cls.get("product", ""))
            tgt_domain = (tgt_cls.get("carrier", ""), tgt_cls.get("product", ""))

            if src_domain != tgt_domain and src_domain[0] and tgt_domain[0]:
                self.errors.append(
                    f"scope 위반: {edge_type} {edge['source']} → {edge['target']} "
                    f"({src_domain} ≠ {tgt_domain})"
                )
                failed += 1
            else:
                passed += 1

        # 관계 유형별 통계
        edge_types = {}
        for e in self.edges:
            t = e.get("type", "?")
            edge_types[t] = edge_types.get(t, 0) + 1

        for t, c in sorted(edge_types.items(), key=lambda x: -x[1])[:10]:
            print(f"  ✓ {t}: {c}건")

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 8. 신선도 / 파일 / 규제
    # ──────────────────────────────────────────────────────────

    def verify_freshness_and_files(self) -> Tuple[int, int]:
        """신선도 계산 가능 여부 + 샘플 파일 + 규제 노드"""
        print("\n[8/8] 신선도 · 파일 · 규제 검증...")
        passed, failed = 0, 0

        # 신선도: ACTIVE 문서 중 EXPIRED 비율
        today = datetime.now()
        fresh_count, warning_count, expired_count = 0, 0, 0
        thresholds = SYSTEM_CONFIG.get("freshness_thresholds", {})

        for doc in self.doc_nodes:
            props = doc.get("properties", {})
            if props.get("lifecycle") != "ACTIVE":
                continue

            updated = props.get("updatedAt") or props.get("createdAt")
            tier = props.get("tier", "WARM")
            max_days = SYSTEM_CONFIG["freshness_defaults"].get(tier, 90)

            if not updated:
                continue

            try:
                updated_dt = datetime.fromisoformat(updated)
                days_since = (today - updated_dt).days
                ratio = days_since / max_days if max_days else 0

                if ratio < thresholds.get("FRESH", 0.7):
                    fresh_count += 1
                elif ratio < thresholds.get("WARNING", 1.0):
                    warning_count += 1
                else:
                    expired_count += 1
                passed += 1
            except Exception:
                self.warnings.append(f"{doc['id']}: 날짜 파싱 실패 ({updated})")

        total_active = fresh_count + warning_count + expired_count
        if total_active:
            print(f"  ✓ ACTIVE 문서 신선도:")
            print(f"    FRESH: {fresh_count}건 ({fresh_count/total_active*100:.1f}%)")
            print(f"    WARNING: {warning_count}건 ({warning_count/total_active*100:.1f}%)")
            print(f"    EXPIRED: {expired_count}건 ({expired_count/total_active*100:.1f}%)")

        # 샘플 파일
        file_count = 0
        if os.path.exists(self.samples_path):
            for root, dirs, files in os.walk(self.samples_path):
                file_count += len([f for f in files if f.endswith(".md")])
        print(f"  ✓ 샘플 파일: {file_count}개")
        passed += file_count

        # 규제 노드
        reg_nodes = [n for n in self.nodes if "Regulation" in n.get("labels", [])]
        print(f"  ✓ 규제 일정: {len(reg_nodes)}개")
        for reg in reg_nodes:
            props = reg.get("properties", {})
            print(f"    - {props.get('date', 'N/A')}: {props.get('name', 'N/A')} ({props.get('status', 'N/A')})")
            passed += 1

        return passed, failed

    # ──────────────────────────────────────────────────────────
    # 실행
    # ──────────────────────────────────────────────────────────

    def run_all(self) -> bool:
        print("=" * 60)
        print("KMS v3.0 프레임워크 검증")
        print("=" * 60)

        if not self.load_graph():
            print("\n❌ 그래프 로드 실패")
            return False

        total_passed, total_failed = 0, 0

        for verify_func in [
            self.verify_taxonomy,           # 1. 분류체계 완전성
            self.verify_graph_integrity,     # 2. 노드/엣지 무결성
            self.verify_required_fields,     # 3. 프레임워크 필수 필드
            self.verify_lifecycle,           # 4. 라이프사이클 상태
            self.verify_ssot,               # 5. SSOT 유니크 제약
            self.verify_domain_assignment,   # 6. 도메인 귀속
            self.verify_relationship_scope,  # 7. 관계 scope 규칙
            self.verify_freshness_and_files, # 8. 신선도 + 파일 + 규제
        ]:
            p, f = verify_func()
            total_passed += p
            total_failed += f

        print("\n" + "=" * 60)
        print("검증 결과")
        print("=" * 60)
        print(f"\n  통과: {total_passed:,}")
        print(f"  실패: {total_failed}")
        print(f"  경고: {len(self.warnings)}")

        if self.errors:
            print(f"\n  오류 ({len(self.errors)}개):")
            for err in self.errors[:10]:
                print(f"    - {err}")
            if len(self.errors) > 10:
                print(f"    ... 외 {len(self.errors) - 10}건")

        print("\n" + "=" * 60)
        if total_failed == 0:
            print("✅ 프레임워크 검증 통과!")
        else:
            print(f"❌ 프레임워크 위반 {total_failed}건")
        print("=" * 60)

        return total_failed == 0


def main():
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    verifier = FrameworkVerifier(base_path)
    return 0 if verifier.run_all() else 1


if __name__ == "__main__":
    exit(main())
