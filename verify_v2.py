"""
KMS v2.0 데이터 검증 스크립트

검증 항목:
1. 분류체계 완전성 검증
2. 그래프 데이터 무결성 검증
3. 문서 파일 존재 여부 검증
4. 관계 규칙 검증
5. RAG 시뮬레이션 테스트
"""

import json
import os
from typing import Dict, List, Tuple
from taxonomy_v2 import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DEFAULT_RELATIONS, DATA_TIERS, RELATION_TYPES,
    get_taxonomy_stats
)


class KMSVerifier:
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.graph_path = os.path.join(base_path, "knowledge_graph_v2.json")
        self.samples_path = os.path.join(base_path, "docs", "samples_v2")
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.graph_data = None
        
    def load_graph(self) -> bool:
        """그래프 데이터 로드"""
        try:
            with open(self.graph_path, "r", encoding="utf-8") as f:
                self.graph_data = json.load(f)
            return True
        except Exception as e:
            self.errors.append(f"그래프 로드 실패: {e}")
            return False
    
    def verify_taxonomy_completeness(self) -> Tuple[int, int]:
        """분류체계 완전성 검증"""
        print("\n[1/5] 분류체계 완전성 검증...")
        passed = 0
        failed = 0
        
        # 보험사 검증
        for carrier_id, carrier in CARRIERS.items():
            if not carrier.get("name"):
                self.errors.append(f"보험사 {carrier_id}: name 누락")
                failed += 1
            elif not carrier.get("type") and carrier_id != "INS-COMMON":
                self.warnings.append(f"보험사 {carrier_id}: type 미지정")
                passed += 1
            else:
                passed += 1
        
        # 상품 검증
        for product_id, product in PRODUCTS.items():
            if not product.get("name"):
                self.errors.append(f"상품 {product_id}: name 누락")
                failed += 1
            elif not product.get("category"):
                self.warnings.append(f"상품 {product_id}: category 미지정")
                passed += 1
            else:
                passed += 1
        
        # 문서유형 검증
        for doc_type_id, doc_type in DOC_TYPES.items():
            if not doc_type.get("name"):
                self.errors.append(f"문서유형 {doc_type_id}: name 누락")
                failed += 1
            elif not doc_type.get("tier"):
                self.errors.append(f"문서유형 {doc_type_id}: tier 누락")
                failed += 1
            else:
                passed += 1
        
        # 티어 설정 검증
        all_doc_types_in_tiers = set()
        for tier, config in DATA_TIERS.items():
            all_doc_types_in_tiers.update(config.get("doc_types", []))
        
        for doc_type_id in DOC_TYPES.keys():
            if doc_type_id not in all_doc_types_in_tiers:
                self.warnings.append(f"문서유형 {doc_type_id}: DATA_TIERS에 미등록")
        
        print(f"  ✓ 보험사: {len(CARRIERS)}개")
        print(f"  ✓ 상품: {len(PRODUCTS)}개")
        print(f"  ✓ 문서유형: {len(DOC_TYPES)}개")
        print(f"  ✓ 프로세스: {len(PROCESSES)}개")
        print(f"  ✓ 대상역할: {len(AUDIENCES)}개")
        
        return passed, failed
    
    def verify_graph_integrity(self) -> Tuple[int, int]:
        """그래프 데이터 무결성 검증"""
        print("\n[2/5] 그래프 데이터 무결성 검증...")
        passed = 0
        failed = 0
        
        if not self.graph_data:
            self.errors.append("그래프 데이터 없음")
            return 0, 1
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        edges = self.graph_data.get("graph_data", {}).get("edges", [])
        
        # 노드 ID 수집
        node_ids = set()
        for node in nodes:
            node_id = node.get("id")
            if not node_id:
                self.errors.append("노드 ID 누락")
                failed += 1
            elif node_id in node_ids:
                self.errors.append(f"중복 노드 ID: {node_id}")
                failed += 1
            else:
                node_ids.add(node_id)
                passed += 1
        
        # 엣지 검증 (소스/타겟 존재 확인)
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            edge_type = edge.get("type")
            
            if source not in node_ids:
                self.errors.append(f"엣지 소스 노드 없음: {source}")
                failed += 1
            elif target not in node_ids:
                self.errors.append(f"엣지 타겟 노드 없음: {target}")
                failed += 1
            elif not edge_type:
                self.warnings.append(f"엣지 타입 누락: {source} -> {target}")
                passed += 1
            else:
                passed += 1
        
        # 문서 노드 필수 속성 검증
        doc_nodes = [n for n in nodes if "Document" in n.get("labels", [])]
        for doc in doc_nodes:
            props = doc.get("properties", {})
            required = ["name", "carrier", "product", "doc_type", "tier"]
            for req in required:
                if not props.get(req):
                    self.errors.append(f"문서 {doc['id']}: {req} 누락")
                    failed += 1
        
        print(f"  ✓ 노드: {len(nodes)}개")
        print(f"  ✓ 엣지: {len(edges)}개")
        print(f"  ✓ 문서 노드: {len(doc_nodes)}개")
        
        return passed, failed
    
    def verify_files_exist(self) -> Tuple[int, int]:
        """샘플 파일 존재 여부 검증"""
        print("\n[3/5] 샘플 파일 존재 여부 검증...")
        passed = 0
        failed = 0
        
        if not os.path.exists(self.samples_path):
            self.errors.append(f"샘플 디렉토리 없음: {self.samples_path}")
            return 0, 1
        
        # 그래프의 문서 노드와 파일 매칭
        if not self.graph_data:
            return 0, 0
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        doc_nodes = [n for n in nodes if "Document" in n.get("labels", [])]
        
        for doc in doc_nodes:
            props = doc.get("properties", {})
            carrier = props.get("carrier", "")
            product = props.get("product", "")
            doc_type = props.get("doc_type", "")
            
            expected_path = os.path.join(
                self.samples_path, carrier, product, f"{doc_type}.md"
            )
            
            if os.path.exists(expected_path):
                passed += 1
            else:
                self.warnings.append(f"파일 없음: {expected_path}")
                failed += 1
        
        # 실제 파일 개수 카운트
        actual_files = 0
        for root, dirs, files in os.walk(self.samples_path):
            actual_files += len([f for f in files if f.endswith(".md")])
        
        print(f"  ✓ 예상 파일: {len(doc_nodes)}개")
        print(f"  ✓ 실제 파일: {actual_files}개")
        print(f"  ✓ 매칭 성공: {passed}개")
        
        return passed, failed
    
    def verify_relations(self) -> Tuple[int, int]:
        """관계 규칙 검증"""
        print("\n[4/5] 관계 규칙 검증...")
        passed = 0
        failed = 0
        
        if not self.graph_data:
            return 0, 0
        
        edges = self.graph_data.get("graph_data", {}).get("edges", [])
        
        # 관계 유형별 검증
        relation_counts = {}
        for edge in edges:
            edge_type = edge.get("type", "UNKNOWN")
            relation_counts[edge_type] = relation_counts.get(edge_type, 0) + 1
        
        # 필수 관계 유형 존재 확인
        expected_relations = ["HAS_CARRIER", "OFFERS", "HAS_DOCUMENT", "REFERENCES"]
        for rel in expected_relations:
            if rel in relation_counts:
                passed += 1
            else:
                self.errors.append(f"필수 관계 없음: {rel}")
                failed += 1
        
        # 양방향 관계 검증 (SIBLINGS)
        siblings_edges = [(e["source"], e["target"]) for e in edges if e["type"] == "SIBLINGS"]
        for src, tgt in siblings_edges:
            reverse = (tgt, src)
            if reverse not in siblings_edges:
                self.warnings.append(f"양방향 관계 불완전: SIBLINGS {src} <-> {tgt}")
        
        print(f"  관계 유형별 개수:")
        for rel_type, count in sorted(relation_counts.items()):
            print(f"    - {rel_type}: {count}개")
        
        return passed, failed
    
    def simulate_rag_query(self) -> None:
        """RAG 검색 시뮬레이션"""
        print("\n[5/5] RAG 검색 시뮬레이션...")
        
        if not self.graph_data:
            return
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        edges = self.graph_data.get("graph_data", {}).get("edges", [])
        
        # 노드 인덱스 생성
        node_map = {n["id"]: n for n in nodes}
        
        # 엣지 인덱스 생성 (source -> [targets])
        edge_map = {}
        for edge in edges:
            source = edge["source"]
            if source not in edge_map:
                edge_map[source] = []
            edge_map[source].append(edge)
        
        # 시뮬레이션 1: 삼성생명 종신보험 수수료 검색
        print("\n  시뮬레이션 1: '삼성생명 종신보험 수수료율'")
        print("  " + "-" * 50)
        
        # 1차: 직접 매칭
        target_doc_id = "DOC-COMMISSION-INS-SAMSUNG-PRD-LIFE-WHOLE-001"
        if target_doc_id in node_map:
            doc = node_map[target_doc_id]
            print(f"  [1차 검색] {doc['properties']['name']}")
            print(f"    - Tier: {doc['properties']['tier']}")
            print(f"    - 프로세스: {doc['properties'].get('processes', [])}")
            
            # 2차: 관련 문서 탐색
            related_edges = edge_map.get(target_doc_id, [])
            print(f"  [2차 관계 탐색] {len(related_edges)}개 관계 발견")
            
            for edge in related_edges[:5]:  # 상위 5개만
                target_id = edge["target"]
                if target_id in node_map:
                    related = node_map[target_id]
                    if "Document" in related.get("labels", []):
                        print(f"    - {edge['type']} → {related['properties']['name']}")
        
        # 시뮬레이션 2: 신입 설계사 교육 자료 검색
        print("\n  시뮬레이션 2: '신입 설계사 교육 자료'")
        print("  " + "-" * 50)
        
        # 대상역할이 AUD-AGENT-NEW인 문서 필터링
        newbie_docs = []
        for node in nodes:
            if "Document" not in node.get("labels", []):
                continue
            audiences = node.get("properties", {}).get("audiences", [])
            if "AUD-AGENT-NEW" in audiences:
                newbie_docs.append(node)
        
        print(f"  [필터 검색] 신입 대상 문서: {len(newbie_docs)}개")
        for doc in newbie_docs[:5]:  # 상위 5개만
            print(f"    - {doc['properties']['name']} ({doc['properties']['doc_type']})")
        
        # 시뮬레이션 3: HOT 티어 문서 (최신 시책/수수료)
        print("\n  시뮬레이션 3: 'HOT 티어 문서 (최신 정보)'")
        print("  " + "-" * 50)
        
        hot_docs = [n for n in nodes if "HOT" in n.get("labels", [])]
        print(f"  [티어 필터] HOT 문서: {len(hot_docs)}개")
        
        # 문서유형별 분류
        hot_by_type = {}
        for doc in hot_docs:
            doc_type = doc.get("properties", {}).get("doc_type", "UNKNOWN")
            if doc_type not in hot_by_type:
                hot_by_type[doc_type] = 0
            hot_by_type[doc_type] += 1
        
        for doc_type, count in hot_by_type.items():
            doc_name = DOC_TYPES.get(doc_type, {}).get("name", doc_type)
            print(f"    - {doc_name}: {count}개")
    
    def run_all(self) -> bool:
        """전체 검증 실행"""
        print("=" * 60)
        print("KMS v2.0 데이터 검증")
        print("=" * 60)
        
        # 그래프 로드
        if not self.load_graph():
            print("\n❌ 그래프 로드 실패")
            return False
        
        total_passed = 0
        total_failed = 0
        
        # 1. 분류체계 검증
        p, f = self.verify_taxonomy_completeness()
        total_passed += p
        total_failed += f
        
        # 2. 그래프 무결성 검증
        p, f = self.verify_graph_integrity()
        total_passed += p
        total_failed += f
        
        # 3. 파일 존재 검증
        p, f = self.verify_files_exist()
        total_passed += p
        total_failed += f
        
        # 4. 관계 규칙 검증
        p, f = self.verify_relations()
        total_passed += p
        total_failed += f
        
        # 5. RAG 시뮬레이션
        self.simulate_rag_query()
        
        # 결과 요약
        print("\n" + "=" * 60)
        print("검증 결과 요약")
        print("=" * 60)
        
        print(f"\n  통과: {total_passed}")
        print(f"  실패: {total_failed}")
        print(f"  경고: {len(self.warnings)}")
        
        if self.errors:
            print(f"\n  ❌ 오류 목록 ({len(self.errors)}개):")
            for err in self.errors[:10]:  # 상위 10개만
                print(f"    - {err}")
            if len(self.errors) > 10:
                print(f"    ... 외 {len(self.errors) - 10}개")
        
        if self.warnings:
            print(f"\n  ⚠️ 경고 목록 ({len(self.warnings)}개):")
            for warn in self.warnings[:5]:  # 상위 5개만
                print(f"    - {warn}")
            if len(self.warnings) > 5:
                print(f"    ... 외 {len(self.warnings) - 5}개")
        
        print("\n" + "=" * 60)
        if total_failed == 0:
            print("✅ 검증 통과!")
        else:
            print(f"❌ 검증 실패 ({total_failed}개 오류)")
        print("=" * 60)
        
        return total_failed == 0


def main():
    base_path = os.path.dirname(os.path.abspath(__file__))
    verifier = KMSVerifier(base_path)
    success = verifier.run_all()
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
