#!/usr/bin/env python3
"""
RAG 시뮬레이터 v2.1

KMS 지식그래프를 활용한 RAG(Retrieval-Augmented Generation) 시뮬레이션.
실제 RAG 시스템 구현 전, 검색/전파 로직을 검증합니다.

시나리오:
1. 수수료 질문 → 시책, 계산기준, 정산자료 전파
2. 상품 비교 질문 → 상품설명서, 비교표, 약관 전파
3. 심사 질문 → 심사가이드, 질병별/직업별 기준 전파
4. 규제 질문 → 법률, 규정, 컴플라이언스가이드 전파
"""

import json
import re
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════════
# 데이터 구조
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Document:
    id: str
    name: str
    carrier: str
    product: str
    doc_type: str
    tier: str
    process: str = ""
    audience: str = ""
    content: str = ""
    relations: Dict = field(default_factory=dict)

@dataclass
class SearchResult:
    doc_id: str
    score: float
    reason: str
    propagated_from: Optional[str] = None

@dataclass
class RAGResponse:
    query: str
    primary_docs: List[SearchResult]
    propagated_docs: List[SearchResult]
    context_summary: str
    retrieval_time_ms: float

# ═══════════════════════════════════════════════════════════════════════════════
# RAG 시뮬레이터
# ═══════════════════════════════════════════════════════════════════════════════

class RAGSimulator:
    def __init__(self, graph_path: str = "knowledge_graph_v2.1.json"):
        self.documents: Dict[str, Document] = {}
        self.taxonomy = {}
        self.edges = []
        self.load_graph(graph_path)
        
    def load_graph(self, path: str):
        """지식그래프 로드"""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.taxonomy = data.get('taxonomy', {})
        
        # 노드 → 문서
        for node in data.get('graph_data', {}).get('nodes', []):
            if 'Document' not in node.get('labels', []):
                continue
            
            props = node.get('properties', {})
            doc_type = next((l for l in node['labels'] if l.startswith('DOC-')), '')
            tier = next((l for l in node['labels'] if l in ['HOT', 'WARM', 'COLD']), 'COLD')
            
            self.documents[node['id']] = Document(
                id=node['id'],
                name=props.get('name', ''),
                carrier=props.get('carrier', ''),
                product=props.get('product', ''),
                doc_type=doc_type,
                tier=tier,
                process=props.get('process', ''),
                audience=props.get('audience', ''),
                content=props.get('content', ''),
                relations={'siblings': [], 'references': [], 'referenced_by': []}
            )
        
        # 엣지 → 관계
        for edge in data.get('graph_data', {}).get('edges', []):
            src = edge.get('source', '')
            tgt = edge.get('target', '')
            rel = edge.get('type', '')
            
            if src in self.documents and tgt in self.documents:
                if rel == 'SIBLINGS':
                    self.documents[src].relations['siblings'].append(tgt)
                elif rel == 'REFERENCES':
                    self.documents[src].relations['references'].append(tgt)
                    self.documents[tgt].relations['referenced_by'].append(src)
        
        print(f"✓ 로드 완료: {len(self.documents)}개 문서")
    
    def keyword_match(self, query: str) -> List[SearchResult]:
        """키워드 기반 1차 검색"""
        results = []
        query_lower = query.lower()
        
        # 키워드 추출
        keywords = self._extract_keywords(query)
        
        for doc_id, doc in self.documents.items():
            score = 0.0
            reasons = []
            
            # 문서명 매칭
            if any(kw in doc.name.lower() for kw in keywords):
                score += 0.5
                reasons.append("문서명 매칭")
            
            # 문서유형 매칭
            doc_type_name = self.taxonomy.get('doc_types', {}).get(doc.doc_type, {}).get('name', '')
            if any(kw in doc_type_name.lower() for kw in keywords):
                score += 0.4
                reasons.append("문서유형 매칭")
            
            # 프로세스 매칭
            process_name = self.taxonomy.get('processes', {}).get(doc.process, {}).get('name', '')
            if any(kw in process_name.lower() for kw in keywords):
                score += 0.3
                reasons.append("프로세스 매칭")
            
            # Tier 가중치
            tier_bonus = {'HOT': 0.2, 'WARM': 0.1, 'COLD': 0.0}
            score += tier_bonus.get(doc.tier, 0)
            
            if score > 0:
                results.append(SearchResult(
                    doc_id=doc_id,
                    score=min(score, 1.0),
                    reason=", ".join(reasons)
                ))
        
        # 점수순 정렬
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:10]  # 상위 10개
    
    def _extract_keywords(self, query: str) -> List[str]:
        """쿼리에서 키워드 추출"""
        # 불용어 제거
        stopwords = {'의', '를', '을', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과', '도', '만', '까지'}
        words = re.findall(r'[가-힣a-zA-Z0-9]+', query.lower())
        return [w for w in words if w not in stopwords and len(w) > 1]
    
    def propagate(self, primary_docs: List[SearchResult], max_depth: int = 2) -> List[SearchResult]:
        """관계 기반 전파"""
        propagated = []
        visited = {r.doc_id for r in primary_docs}
        
        def _propagate_from(doc_id: str, depth: int, from_id: str):
            if depth > max_depth:
                return
            
            doc = self.documents.get(doc_id)
            if not doc:
                return
            
            # 형제 문서 (전파 점수 감소)
            for sib_id in doc.relations.get('siblings', []):
                if sib_id not in visited:
                    visited.add(sib_id)
                    propagated.append(SearchResult(
                        doc_id=sib_id,
                        score=0.7 / depth,
                        reason=f"형제관계 (depth={depth})",
                        propagated_from=from_id
                    ))
                    _propagate_from(sib_id, depth + 1, sib_id)
            
            # 참조 문서
            for ref_id in doc.relations.get('references', []):
                if ref_id not in visited:
                    visited.add(ref_id)
                    propagated.append(SearchResult(
                        doc_id=ref_id,
                        score=0.6 / depth,
                        reason=f"참조관계 (depth={depth})",
                        propagated_from=from_id
                    ))
                    _propagate_from(ref_id, depth + 1, ref_id)
            
            # 역참조 (이 문서를 참조하는 문서)
            for ref_by_id in doc.relations.get('referenced_by', []):
                if ref_by_id not in visited:
                    visited.add(ref_by_id)
                    propagated.append(SearchResult(
                        doc_id=ref_by_id,
                        score=0.5 / depth,
                        reason=f"역참조 (depth={depth})",
                        propagated_from=from_id
                    ))
        
        # 1차 검색 결과에서 전파 시작
        for result in primary_docs[:5]:  # 상위 5개에서만 전파
            _propagate_from(result.doc_id, 1, result.doc_id)
        
        # 점수순 정렬
        propagated.sort(key=lambda x: x.score, reverse=True)
        return propagated[:15]  # 상위 15개
    
    def generate_context(self, primary: List[SearchResult], propagated: List[SearchResult]) -> str:
        """컨텍스트 요약 생성"""
        all_docs = primary + propagated
        if not all_docs:
            return "관련 문서를 찾지 못했습니다."
        
        # 문서 유형별 그룹화
        by_type = {}
        for r in all_docs[:10]:
            doc = self.documents.get(r.doc_id)
            if doc:
                doc_type_name = self.taxonomy.get('doc_types', {}).get(doc.doc_type, {}).get('name', doc.doc_type)
                if doc_type_name not in by_type:
                    by_type[doc_type_name] = []
                by_type[doc_type_name].append(doc.name)
        
        lines = ["[검색된 문서]"]
        for doc_type, names in by_type.items():
            lines.append(f"- {doc_type}: {', '.join(names[:3])}")
        
        return "\n".join(lines)
    
    def search(self, query: str) -> RAGResponse:
        """RAG 검색 수행"""
        import time
        start = time.time()
        
        # 1차: 키워드 검색
        primary = self.keyword_match(query)
        
        # 2차: 관계 전파
        propagated = self.propagate(primary)
        
        # 컨텍스트 생성
        context = self.generate_context(primary, propagated)
        
        elapsed = (time.time() - start) * 1000
        
        return RAGResponse(
            query=query,
            primary_docs=primary,
            propagated_docs=propagated,
            context_summary=context,
            retrieval_time_ms=elapsed
        )

# ═══════════════════════════════════════════════════════════════════════════════
# 시나리오 테스트
# ═══════════════════════════════════════════════════════════════════════════════

def run_scenarios():
    """RAG 시나리오 테스트 실행"""
    print("=" * 70)
    print("KMS RAG Simulator v2.1")
    print("=" * 70)
    print()
    
    rag = RAGSimulator()
    
    scenarios = [
        {
            "name": "시나리오 1: 수수료 질문",
            "query": "삼성생명 종신보험 수수료가 어떻게 되나요?",
            "expected_types": ["DOC-COMMISSION", "DOC-INCENTIVE", "DOC-COMMISSION-CALC", "DOC-SETTLEMENT"]
        },
        {
            "name": "시나리오 2: 상품 비교",
            "query": "어린이보험 상품 비교해주세요",
            "expected_types": ["DOC-COMPARISON", "DOC-GUIDE", "DOC-TERMS"]
        },
        {
            "name": "시나리오 3: 심사 문의",
            "query": "당뇨 환자 심사 가능한가요?",
            "expected_types": ["DOC-UW-GUIDE", "DOC-UW-DISEASE", "DOC-UW-RULE"]
        },
        {
            "name": "시나리오 4: 규제 문의",
            "query": "1200%룰 GA 적용 언제부터인가요?",
            "expected_types": ["DOC-LAW-INSURANCE", "DOC-REGULATION", "DOC-COMPLIANCE-GUIDE"]
        }
    ]
    
    results = []
    
    for scenario in scenarios:
        print(f"\n{'─' * 70}")
        print(f"📋 {scenario['name']}")
        print(f"❓ 쿼리: {scenario['query']}")
        print(f"{'─' * 70}")
        
        response = rag.search(scenario['query'])
        
        # 1차 검색 결과
        print(f"\n🔍 1차 검색 결과 ({len(response.primary_docs)}건):")
        found_types = set()
        for r in response.primary_docs[:5]:
            doc = rag.documents.get(r.doc_id)
            if doc:
                found_types.add(doc.doc_type)
                print(f"   • [{r.score:.2f}] {doc.name}")
                print(f"     └ {r.reason}")
        
        # 전파 결과
        print(f"\n🔗 전파 결과 ({len(response.propagated_docs)}건):")
        for r in response.propagated_docs[:5]:
            doc = rag.documents.get(r.doc_id)
            if doc:
                found_types.add(doc.doc_type)
                from_doc = rag.documents.get(r.propagated_from)
                from_name = from_doc.name if from_doc else r.propagated_from
                print(f"   • [{r.score:.2f}] {doc.name}")
                print(f"     └ {r.reason} ← {from_name}")
        
        # 컨텍스트
        print(f"\n📄 컨텍스트:")
        for line in response.context_summary.split('\n'):
            print(f"   {line}")
        
        # 검증
        expected_set = set(scenario['expected_types'])
        matched = found_types & expected_set
        match_rate = len(matched) / len(expected_set) * 100 if expected_set else 0
        
        print(f"\n✅ 검증:")
        print(f"   기대 유형: {', '.join(expected_set)}")
        print(f"   발견 유형: {', '.join(found_types)}")
        print(f"   매칭률: {match_rate:.1f}%")
        print(f"   검색 시간: {response.retrieval_time_ms:.2f}ms")
        
        results.append({
            "scenario": scenario['name'],
            "match_rate": match_rate,
            "primary_count": len(response.primary_docs),
            "propagated_count": len(response.propagated_docs),
            "time_ms": response.retrieval_time_ms
        })
    
    # 요약
    print(f"\n{'═' * 70}")
    print("📊 테스트 요약")
    print(f"{'═' * 70}")
    
    total_match = sum(r['match_rate'] for r in results) / len(results)
    total_time = sum(r['time_ms'] for r in results)
    
    for r in results:
        status = "✅" if r['match_rate'] >= 50 else "⚠️"
        print(f"{status} {r['scenario']}: 매칭률 {r['match_rate']:.1f}%, "
              f"1차 {r['primary_count']}건, 전파 {r['propagated_count']}건")
    
    print(f"\n평균 매칭률: {total_match:.1f}%")
    print(f"총 검색 시간: {total_time:.2f}ms")
    
    return results


def main():
    """메인 실행"""
    try:
        results = run_scenarios()
        
        # JSON 결과 저장
        output = {
            "timestamp": datetime.now().isoformat(),
            "version": "2.1",
            "results": results,
            "summary": {
                "total_scenarios": len(results),
                "avg_match_rate": sum(r['match_rate'] for r in results) / len(results),
                "avg_time_ms": sum(r['time_ms'] for r in results) / len(results)
            }
        }
        
        with open('docs/rag_simulation_results.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ 결과 저장: docs/rag_simulation_results.json")
        
    except FileNotFoundError:
        print("❌ knowledge_graph_v2.1.json 파일을 찾을 수 없습니다.")
        print("   먼저 simulator_v2_extended.py를 실행하세요.")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
