#!/usr/bin/env python3
"""
온톨로지 검증 시뮬레이터 v1.0

온톨로지 기반 지식그래프(knowledge_graph_ontology.json)를 로드하여
클래스 계층, 개념 관계, 동의어, 프로세스 순서, 규제 영향 등을
RAG 시나리오로 검증한다.

설계→시뮬레이션→검증 사이클의 '검증' 단계.
"""

import json
import re
import time
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional
from datetime import datetime

from taxonomy_ontology import (
    SYNONYM_MAP, CONCEPTS, RELATION_TYPES,
    DOC_TYPE_CLASS_MAP, PROCESS_CLASS_MAP,
    get_class_hierarchy, get_all_subclasses,
    resolve_synonyms, get_related_concepts,
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
class SearchResult:
    node_id: str
    score: float
    reason: str
    propagated_from: Optional[str] = None

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

    def __init__(self, path: str = "knowledge_graph_ontology.json"):
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
# 온톨로지 기반 RAG 검색
# ═══════════════════════════════════════════════════════════════════════════════

class OntologyRAG:
    """온톨로지 정보를 활용하는 RAG 검색 엔진"""

    def __init__(self, graph: OntologyGraph):
        self.g = graph

    def search(self, query: str) -> List[SearchResult]:
        """통합 검색: 키워드 + 동의어 + 온톨로지 클래스 + 개념 전파"""
        results: Dict[str, SearchResult] = {}

        # 1. 키워드 추출
        keywords = self._extract_keywords(query)

        # 2. 동의어 확장 → 문서유형 코드
        expanded_doc_types = set()
        for kw in keywords:
            synonyms = resolve_synonyms(kw)
            expanded_doc_types.update(synonyms)

        # 3. 키워드 매칭
        for doc in self.g.documents():
            score = 0.0
            reasons = []

            # 문서명 매칭
            if any(kw in doc.properties.get("name", "").lower() for kw in keywords):
                score += 0.5
                reasons.append("문서명 매칭")

            # 동의어 확장 문서유형 매칭
            doc_type = doc.properties.get("doc_type", "")
            if doc_type in expanded_doc_types:
                score += 0.6
                reasons.append("동의어 확장 매칭")

            # 문서유형명 매칭
            doc_type_name = self.g.taxonomy.get("doc_types", {}).get(doc_type, {}).get("name", "")
            if any(kw in doc_type_name.lower() for kw in keywords):
                score += 0.4
                reasons.append("문서유형명 매칭")

            # 보험사/상품 매칭
            carrier = doc.properties.get("carrier", "")
            carrier_name = self.g.taxonomy.get("carriers", {}).get(carrier, {}).get("name", "")
            carrier_aliases = self.g.taxonomy.get("carriers", {}).get(carrier, {}).get("alias", [])
            all_carrier_names = [carrier_name.lower()] + [a.lower() for a in carrier_aliases]
            if any(kw in cn for kw in keywords for cn in all_carrier_names if cn):
                score += 0.3
                reasons.append("보험사 매칭")

            # Tier 가중치
            tier = doc.properties.get("tier", "COLD")
            tier_bonus = {"HOT": 0.2, "WARM": 0.1, "COLD": 0.0}
            score += tier_bonus.get(tier, 0)

            if score > 0:
                results[doc.id] = SearchResult(
                    node_id=doc.id,
                    score=min(score, 1.0),
                    reason=", ".join(reasons),
                )

        # 4. 관계 전파
        primary_ids = sorted(results.keys(), key=lambda x: results[x].score, reverse=True)[:5]
        propagated = self._propagate(primary_ids, set(results.keys()))
        for sr in propagated:
            if sr.node_id not in results or results[sr.node_id].score < sr.score:
                results[sr.node_id] = sr

        # 5. 개념 기반 확장
        concept_results = self._concept_search(keywords)
        for sr in concept_results:
            if sr.node_id not in results:
                results[sr.node_id] = sr

        # 정렬 반환
        all_results = sorted(results.values(), key=lambda x: x.score, reverse=True)
        return all_results[:20]

    def search_by_class(self, ontology_class: str) -> List[Node]:
        """온톨로지 클래스 기반 검색 (계층 포함)"""
        return self.g.nodes_by_type_hierarchy(ontology_class)

    def search_by_process(self, process_id: str) -> List[SearchResult]:
        """프로세스에서 사용되는 문서 검색 (USED_IN 역추적)"""
        results = []
        edges = self.g.incoming(process_id, "USED_IN")
        for e in edges:
            node = self.g.nodes.get(e.source)
            if node and "Document" in node.labels:
                results.append(SearchResult(
                    node_id=node.id,
                    score=0.8,
                    reason=f"프로세스 {process_id} USED_IN",
                ))
        return results

    def search_regulation_impact(self, reg_id: str) -> Dict[str, List[str]]:
        """규제 영향 범위 검색: GOVERNS(프로세스), RESTRICTS(문서)"""
        governed = []
        restricted = []

        for e in self.g.outgoing(reg_id, "GOVERNS"):
            governed.append(e.target)
        for e in self.g.outgoing(reg_id, "RESTRICTS"):
            restricted.append(e.target)

        return {"governed_processes": governed, "restricted_docs": restricted}

    def get_process_chain(self, start_id: str) -> List[str]:
        """PRECEDES 체인 따라가기"""
        chain = [start_id]
        current = start_id
        visited = {start_id}
        while True:
            next_edges = self.g.outgoing(current, "PRECEDES")
            if not next_edges:
                break
            next_id = next_edges[0].target
            if next_id in visited:
                break
            visited.add(next_id)
            chain.append(next_id)
            current = next_id
        return chain

    def get_concept_graph(self, concept_id: str) -> Dict:
        """개념 노드의 관계 그래프 반환"""
        result = {"broader": [], "narrower": [], "related": [], "explains": []}

        for e in self.g.outgoing(concept_id):
            if e.rel_type == "BROADER":
                result["broader"].append(e.target)
            elif e.rel_type == "NARROWER":
                result["narrower"].append(e.target)
            elif e.rel_type in ("RELATED_TO", "ANTONYM_OF"):
                result["related"].append(e.target)
            elif e.rel_type == "EXPLAINS":
                result["explains"].append(e.target)
        return result

    # ── 내부 메서드 ──

    def _extract_keywords(self, query: str) -> List[str]:
        stopwords = {"의", "를", "을", "이", "가", "은", "는", "에", "에서",
                     "로", "으로", "와", "과", "도", "만", "까지", "어떻게",
                     "언제", "얼마", "뭐", "무엇", "가능", "어디", "해주세요",
                     "인가요", "되나요", "합니다", "있나요", "부터"}
        words = re.findall(r"[가-힣a-zA-Z0-9%]+", query.lower())
        return [w for w in words if w not in stopwords and len(w) > 1]

    def _propagate(self, seed_ids: List[str], visited: Set[str], max_depth: int = 2) -> List[SearchResult]:
        propagated = []

        def _walk(node_id: str, depth: int, from_id: str):
            if depth > max_depth:
                return
            for e in self.g.outgoing(node_id):
                if e.target in visited:
                    continue
                if e.rel_type not in ("SIBLINGS", "REFERENCES", "HAS_DOCUMENT"):
                    continue
                target_node = self.g.nodes.get(e.target)
                if not target_node or "Document" not in target_node.labels:
                    continue

                visited.add(e.target)
                score_map = {"SIBLINGS": 0.7, "REFERENCES": 0.6, "HAS_DOCUMENT": 0.5}
                propagated.append(SearchResult(
                    node_id=e.target,
                    score=score_map.get(e.rel_type, 0.5) / depth,
                    reason=f"{e.rel_type} (depth={depth})",
                    propagated_from=from_id,
                ))
                _walk(e.target, depth + 1, from_id)

            # 역방향도 탐색 (REFERENCED_BY 등)
            for e in self.g.incoming(node_id):
                if e.source in visited:
                    continue
                if e.rel_type not in ("REFERENCES", "SIBLINGS"):
                    continue
                src_node = self.g.nodes.get(e.source)
                if not src_node or "Document" not in src_node.labels:
                    continue

                visited.add(e.source)
                propagated.append(SearchResult(
                    node_id=e.source,
                    score=0.5 / depth,
                    reason=f"역{e.rel_type} (depth={depth})",
                    propagated_from=from_id,
                ))

        for sid in seed_ids:
            _walk(sid, 1, sid)

        return propagated

    def _concept_search(self, keywords: List[str]) -> List[SearchResult]:
        """키워드 → 개념 → EXPLAINS → 문서"""
        results = []
        found_docs = set()

        for kw in keywords:
            concept_ids = get_related_concepts(kw)
            for cid in concept_ids:
                # 개념이 EXPLAINS하는 문서 탐색
                for e in self.g.outgoing(cid, "EXPLAINS"):
                    target = self.g.nodes.get(e.target)
                    if target and "Document" in target.labels and e.target not in found_docs:
                        found_docs.add(e.target)
                        results.append(SearchResult(
                            node_id=e.target,
                            score=0.55,
                            reason=f"개념 '{cid}' EXPLAINS",
                            propagated_from=cid,
                        ))
        return results


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


def validate_ontology_search(rag: OntologyRAG, g: OntologyGraph) -> List[ValidationResult]:
    """온톨로지 기반 검색 시나리오 검증"""
    results = []

    # ── 시나리오 1: 동의어 확장 검색 ──
    query = "삼성생명 종신보험 수수료가 어떻게 되나요?"
    search_results = rag.search(query)
    found_types = set()
    found_carriers = set()
    for sr in search_results:
        node = g.nodes.get(sr.node_id)
        if node:
            found_types.add(node.properties.get("doc_type", ""))
            found_carriers.add(node.properties.get("carrier", ""))

    expected_types = {"DOC-COMMISSION", "DOC-INCENTIVE", "DOC-COMMISSION-CALC", "DOC-SETTLEMENT"}
    matched = found_types & expected_types
    score1 = len(matched) / len(expected_types) if expected_types else 0
    has_samsung = "INS-SAMSUNG" in found_carriers
    results.append(ValidationResult(
        name="시나리오1: 수수료 동의어 확장",
        passed=score1 >= 0.5 and has_samsung,
        score=score1,
        details=f"기대: {expected_types}, 발견: {found_types & expected_types}, 삼성매칭: {has_samsung}",
        found_count=len(matched),
        expected_count=len(expected_types),
    ))

    # ── 시나리오 2: 온톨로지 클래스 검색 ──
    uw_docs = rag.search_by_class("ga:UWDocument")
    uw_count = len(uw_docs)
    results.append(ValidationResult(
        name="시나리오2: UW 클래스 계층 검색",
        passed=uw_count >= 5,
        score=min(uw_count / 20, 1.0),
        details=f"ga:UWDocument 하위 {uw_count}개 노드",
        found_count=uw_count,
        expected_count=20,
    ))

    # ── 시나리오 3: 심사 질문 + 동의어 + 클래스 ──
    query = "당뇨 환자 심사 가능한가요?"
    search_results = rag.search(query)
    found_types = set()
    for sr in search_results:
        node = g.nodes.get(sr.node_id)
        if node:
            found_types.add(node.properties.get("doc_type", ""))

    expected = {"DOC-UW-GUIDE", "DOC-UW-DISEASE", "DOC-UW-RULE"}
    matched = found_types & expected
    score3 = len(matched) / len(expected) if expected else 0
    results.append(ValidationResult(
        name="시나리오3: 심사 동의어+클래스",
        passed=score3 >= 0.5,
        score=score3,
        details=f"기대: {expected}, 발견: {found_types & expected}",
        found_count=len(matched),
        expected_count=len(expected),
    ))

    # ── 시나리오 4: 규제 영향 범위 ──
    impact = rag.search_regulation_impact("REG-20260701")
    has_gov = len(impact["governed_processes"]) > 0
    has_res = len(impact["restricted_docs"]) > 0
    score4 = (1.0 if has_gov else 0.0) * 0.5 + (1.0 if has_res else 0.0) * 0.5
    results.append(ValidationResult(
        name="시나리오4: 1200%룰 규제 영향",
        passed=has_gov and has_res,
        score=score4,
        details=f"GOVERNS: {impact['governed_processes']}, RESTRICTS: {impact['restricted_docs']}",
        found_count=len(impact["governed_processes"]) + len(impact["restricted_docs"]),
        expected_count=3,
    ))

    # ── 시나리오 5: 프로세스 체인 ──
    chain = rag.get_process_chain("BIZ-PROSPECT")
    expected_chain = ["BIZ-PROSPECT", "BIZ-CONSULT", "BIZ-UW", "BIZ-ISSUE",
                      "BIZ-HAPPYCALL", "BIZ-MAINTAIN", "BIZ-CLAIM"]
    chain_match = sum(1 for a, b in zip(chain, expected_chain) if a == b)
    score5 = chain_match / len(expected_chain)
    results.append(ValidationResult(
        name="시나리오5: 판매프로세스 순서",
        passed=score5 >= 0.8,
        score=score5,
        details=f"체인: {' → '.join(chain)}",
        found_count=chain_match,
        expected_count=len(expected_chain),
    ))

    # ── 시나리오 6: 프로세스 기반 문서 검색 ──
    settle_docs = rag.search_by_process("BIZ-SETTLE")
    settle_types = set()
    for sr in settle_docs:
        node = g.nodes.get(sr.node_id)
        if node:
            settle_types.add(node.properties.get("doc_type", ""))
    expected_settle = {"DOC-COMMISSION", "DOC-COMMISSION-CALC", "DOC-SETTLEMENT", "DOC-CHARGEBACK"}
    matched_settle = settle_types & expected_settle
    score6 = len(matched_settle) / len(expected_settle) if expected_settle else 0
    results.append(ValidationResult(
        name="시나리오6: 정산 프로세스 문서",
        passed=score6 >= 0.5,
        score=score6,
        details=f"기대: {expected_settle}, 발견: {matched_settle}",
        found_count=len(matched_settle),
        expected_count=len(expected_settle),
    ))

    # ── 시나리오 7: 개념 그래프 탐색 ──
    concept_graph = rag.get_concept_graph("CONCEPT-GROSS-PREMIUM")
    has_narrower = len(concept_graph["narrower"]) >= 2
    has_explains = len(concept_graph["explains"]) >= 1
    score7 = (0.5 if has_narrower else 0.0) + (0.5 if has_explains else 0.0)
    results.append(ValidationResult(
        name="시나리오7: 보험료 개념 그래프",
        passed=has_narrower and has_explains,
        score=score7,
        details=f"하위개념: {concept_graph['narrower']}, EXPLAINS: {concept_graph['explains']}",
        found_count=len(concept_graph["narrower"]) + len(concept_graph["explains"]),
        expected_count=3,
    ))

    # ── 시나리오 8: 상품비교 검색 ──
    query = "어린이보험 상품 비교해주세요"
    search_results = rag.search(query)
    found_types = set()
    for sr in search_results:
        node = g.nodes.get(sr.node_id)
        if node:
            found_types.add(node.properties.get("doc_type", ""))

    expected = {"DOC-COMPARISON", "DOC-GUIDE", "DOC-TERMS"}
    matched = found_types & expected
    score8 = len(matched) / len(expected)
    results.append(ValidationResult(
        name="시나리오8: 상품비교 검색",
        passed=score8 >= 0.5,
        score=score8,
        details=f"기대: {expected}, 발견: {found_types & expected}",
        found_count=len(matched),
        expected_count=len(expected),
    ))

    # ── 시나리오 9: 규제 질문 자연어 검색 ──
    query = "1200%룰 GA 적용 언제부터인가요?"
    search_results = rag.search(query)
    found_types = set()
    for sr in search_results:
        node = g.nodes.get(sr.node_id)
        if node:
            found_types.add(node.properties.get("doc_type", ""))

    expected = {"DOC-REGULATION", "DOC-COMMISSION-CALC"}
    matched = found_types & expected
    score9 = len(matched) / len(expected)
    results.append(ValidationResult(
        name="시나리오9: 규제 자연어 질문",
        passed=score9 >= 0.5,
        score=score9,
        details=f"기대: {expected}, 발견: {found_types & expected}",
        found_count=len(matched),
        expected_count=len(expected),
    ))

    # ── 시나리오 10: 교육/온보딩 검색 ──
    query = "신입 설계사 교육자료 어디있나요?"
    search_results = rag.search(query)
    found_types = set()
    for sr in search_results:
        node = g.nodes.get(sr.node_id)
        if node:
            found_types.add(node.properties.get("doc_type", ""))

    expected = {"DOC-TRAINING", "DOC-ONBOARDING"}
    matched = found_types & expected
    score10 = len(matched) / len(expected)
    results.append(ValidationResult(
        name="시나리오10: 교육 검색",
        passed=score10 >= 0.5,
        score=score10,
        details=f"기대: {expected}, 발견: {found_types & expected}",
        found_count=len(matched),
        expected_count=len(expected),
    ))

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 메인 실행
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("온톨로지 검증 시뮬레이터 v1.0")
    print("=" * 70)

    start_time = time.time()

    # 그래프 로드
    print("\n[1/3] 온톨로지 그래프 로드")
    try:
        g = OntologyGraph("knowledge_graph_ontology.json")
    except FileNotFoundError:
        print("  knowledge_graph_ontology.json을 찾을 수 없습니다.")
        print("  먼저 simulator_ontology.py를 실행하세요.")
        return 1

    rag = OntologyRAG(g)

    # 구조 검증
    print("\n[2/3] 그래프 구조 검증")
    print("-" * 70)
    structure_results = validate_graph_structure(g)
    for vr in structure_results:
        status = "PASS" if vr.passed else "FAIL"
        print(f"  [{status}] {vr.name}: {vr.score:.0%} ({vr.details})")

    # 시나리오 검증
    print("\n[3/3] RAG 시나리오 검증")
    print("-" * 70)
    search_results = validate_ontology_search(rag, g)
    for vr in search_results:
        status = "PASS" if vr.passed else "FAIL"
        print(f"  [{status}] {vr.name}: {vr.score:.0%}")
        print(f"         {vr.details}")

    # 종합 요약
    all_results = structure_results + search_results
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
        "version": "1.0-ontology",
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

    output_path = "docs/ontology_validation_results.json"
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
