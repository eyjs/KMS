"""
KMS v2.1 데이터 검증 스크립트
"""

import json
import os
from typing import List, Tuple
from taxonomy_v2_extended import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DATA_TIERS, CERTIFICATIONS, GA_TYPES, REGULATION_TIMELINE,
    get_taxonomy_stats
)


class KMSVerifierExtended:
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.graph_path = os.path.join(base_path, "knowledge_graph_v2.1.json")
        self.samples_path = os.path.join(base_path, "docs", "samples_v2.1")
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.graph_data = None
        
    def load_graph(self) -> bool:
        try:
            with open(self.graph_path, "r", encoding="utf-8") as f:
                self.graph_data = json.load(f)
            return True
        except Exception as e:
            self.errors.append(f"그래프 로드 실패: {e}")
            return False
    
    def verify_taxonomy(self) -> Tuple[int, int]:
        """분류체계 완전성 검증"""
        print("\n[1/6] 분류체계 완전성 검증...")
        passed, failed = 0, 0
        
        # 모든 문서유형이 DATA_TIERS에 포함되어 있는지
        all_tier_docs = set()
        for tier, config in DATA_TIERS.items():
            all_tier_docs.update(config.get("doc_types", []))
        
        for doc_type_id in DOC_TYPES.keys():
            if doc_type_id not in all_tier_docs:
                self.errors.append(f"문서유형 {doc_type_id}: DATA_TIERS에 미등록")
                failed += 1
            else:
                passed += 1
        
        stats = get_taxonomy_stats()
        print(f"  ✓ 보험사: {stats['carriers']['total']}개")
        print(f"  ✓ 상품: {stats['products']['total']}개")
        print(f"  ✓ 문서유형: {stats['doc_types']['total']}개")
        print(f"  ✓ 프로세스: {stats['processes']}개")
        print(f"  ✓ 역할: {stats['audiences']}개")
        print(f"  ✓ 자격증: {stats['certifications']}개")
        print(f"  ✓ GA유형: {stats['ga_types']}개")
        
        return passed, failed
    
    def verify_graph_integrity(self) -> Tuple[int, int]:
        """그래프 무결성 검증"""
        print("\n[2/6] 그래프 데이터 무결성 검증...")
        passed, failed = 0, 0
        
        if not self.graph_data:
            return 0, 1
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        edges = self.graph_data.get("graph_data", {}).get("edges", [])
        
        node_ids = set()
        for node in nodes:
            node_id = node.get("id")
            if node_id in node_ids:
                self.errors.append(f"중복 노드: {node_id}")
                failed += 1
            else:
                node_ids.add(node_id)
                passed += 1
        
        for edge in edges:
            if edge["source"] not in node_ids:
                self.errors.append(f"엣지 소스 없음: {edge['source']}")
                failed += 1
            elif edge["target"] not in node_ids:
                self.errors.append(f"엣지 타겟 없음: {edge['target']}")
                failed += 1
            else:
                passed += 1
        
        print(f"  ✓ 노드: {len(nodes)}개")
        print(f"  ✓ 엣지: {len(edges)}개")
        
        return passed, failed
    
    def verify_process_mapping(self) -> Tuple[int, int]:
        """프로세스 매핑 검증"""
        print("\n[3/6] 프로세스 매핑 검증...")
        passed, failed = 0, 0
        
        if not self.graph_data:
            return 0, 0
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        doc_nodes = [n for n in nodes if "Document" in n.get("labels", [])]
        
        for doc in doc_nodes:
            processes = doc.get("properties", {}).get("processes", [])
            if not processes:
                self.warnings.append(f"프로세스 미지정: {doc['id']}")
            else:
                for proc in processes:
                    if proc not in PROCESSES:
                        self.errors.append(f"잘못된 프로세스: {doc['id']} - {proc}")
                        failed += 1
                    else:
                        passed += 1
        
        print(f"  ✓ 문서-프로세스 매핑: {passed}개")
        
        return passed, failed
    
    def verify_audience_mapping(self) -> Tuple[int, int]:
        """역할 매핑 검증"""
        print("\n[4/6] 대상역할 매핑 검증...")
        passed, failed = 0, 0
        
        if not self.graph_data:
            return 0, 0
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        doc_nodes = [n for n in nodes if "Document" in n.get("labels", [])]
        
        for doc in doc_nodes:
            audiences = doc.get("properties", {}).get("audiences", [])
            if not audiences:
                self.warnings.append(f"대상역할 미지정: {doc['id']}")
            else:
                for aud in audiences:
                    if aud not in AUDIENCES:
                        self.errors.append(f"잘못된 역할: {doc['id']} - {aud}")
                        failed += 1
                    else:
                        passed += 1
        
        print(f"  ✓ 문서-역할 매핑: {passed}개")
        
        return passed, failed
    
    def verify_files(self) -> Tuple[int, int]:
        """파일 존재 검증"""
        print("\n[5/6] 샘플 파일 존재 검증...")
        
        if not os.path.exists(self.samples_path):
            self.errors.append(f"샘플 디렉토리 없음: {self.samples_path}")
            return 0, 1
        
        file_count = 0
        for root, dirs, files in os.walk(self.samples_path):
            file_count += len([f for f in files if f.endswith(".md")])
        
        print(f"  ✓ 샘플 파일: {file_count}개")
        
        return file_count, 0
    
    def verify_regulations(self) -> Tuple[int, int]:
        """규제 일정 검증"""
        print("\n[6/6] 규제 일정 검증...")
        passed, failed = 0, 0
        
        if not self.graph_data:
            return 0, 0
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        reg_nodes = [n for n in nodes if "Regulation" in n.get("labels", [])]
        
        print(f"  ✓ 규제 일정: {len(reg_nodes)}개")
        
        for reg in reg_nodes:
            props = reg.get("properties", {})
            print(f"    - {props.get('date', 'N/A')}: {props.get('name', 'N/A')} ({props.get('status', 'N/A')})")
            passed += 1
        
        return passed, failed
    
    def simulate_rag(self):
        """RAG 시뮬레이션"""
        print("\n[RAG 시뮬레이션]")
        
        if not self.graph_data:
            return
        
        nodes = self.graph_data.get("graph_data", {}).get("nodes", [])
        
        # 시뮬레이션 1: 1200%룰 관련 문서
        print("\n  쿼리: '2026년 7월 1200%룰 확대 적용 관련 문서'")
        print("  " + "-" * 50)
        
        results = []
        for node in nodes:
            if "Document" not in node.get("labels", []):
                continue
            props = node.get("properties", {})
            name = props.get("name", "")
            doc_type = props.get("doc_type", "")
            
            if any(kw in name or kw in doc_type for kw in ["수수료", "COMMISSION", "REGULATION", "규정"]):
                results.append(f"  - {name} ({doc_type})")
        
        for r in results[:5]:
            print(r)
        print(f"  ... 총 {len(results)}개 문서 발견")
        
        # 시뮬레이션 2: 신입 설계사 컴플라이언스
        print("\n  쿼리: '신입 설계사가 알아야 할 컴플라이언스'")
        print("  " + "-" * 50)
        
        results = []
        for node in nodes:
            if "Document" not in node.get("labels", []):
                continue
            props = node.get("properties", {})
            audiences = props.get("audiences", [])
            processes = props.get("processes", [])
            
            if "AUD-AGENT-NEW" in audiences or "BIZ-COMPLIANCE" in processes:
                results.append(f"  - {props.get('name', '')} ({props.get('doc_type', '')})")
        
        for r in results[:5]:
            print(r)
        print(f"  ... 총 {len(results)}개 문서 발견")
    
    def run_all(self) -> bool:
        print("=" * 60)
        print("KMS v2.1 데이터 검증")
        print("=" * 60)
        
        if not self.load_graph():
            print("\n❌ 그래프 로드 실패")
            return False
        
        total_passed, total_failed = 0, 0
        
        for verify_func in [
            self.verify_taxonomy,
            self.verify_graph_integrity,
            self.verify_process_mapping,
            self.verify_audience_mapping,
            self.verify_files,
            self.verify_regulations,
        ]:
            p, f = verify_func()
            total_passed += p
            total_failed += f
        
        self.simulate_rag()
        
        print("\n" + "=" * 60)
        print("검증 결과")
        print("=" * 60)
        print(f"\n  통과: {total_passed}")
        print(f"  실패: {total_failed}")
        print(f"  경고: {len(self.warnings)}")
        
        if self.errors:
            print(f"\n  ❌ 오류 ({len(self.errors)}개):")
            for err in self.errors[:5]:
                print(f"    - {err}")
        
        print("\n" + "=" * 60)
        if total_failed == 0:
            print("✅ 검증 통과!")
        else:
            print(f"❌ 검증 실패 ({total_failed}개 오류)")
        print("=" * 60)
        
        return total_failed == 0


def main():
    base_path = os.path.dirname(os.path.abspath(__file__))
    verifier = KMSVerifierExtended(base_path)
    return 0 if verifier.run_all() else 1


if __name__ == "__main__":
    exit(main())
