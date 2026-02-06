#!/usr/bin/env python3
"""
Phase 1: Warehouse API — 순수 기계적 데이터 접근 계층

원칙:
  - 판단하지 않는다. 요청한 조건에 맞는 데이터를 그대로 반환한다.
  - 스코어링, 랭킹, 추천, 필터링 결정 없음.
  - 같은 요청 → 항상 같은 결과 (결정론적).

보장하는 것:
  Q1. 분류 정확성 — 6-Facet 태깅이 정확한가
  Q2. 관계 정확성 — 엣지가 올바른 노드를 연결하는가
  Q3. 완전성 — 조건에 맞는 문서를 누락 없이 반환하는가
  Q4. 유니크 — 동일 경로에 중복이 없는가
  Q5. 결정론 — 같은 요청에 같은 결과가 나오는가
"""

import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set


# ═══════════════════════════════════════════════════════════════════════════════
# 데이터 구조 (창고 내부)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Document:
    """창고에 저장된 문서"""
    id: str
    labels: List[str]
    types: List[str]       # @type 온톨로지 클래스
    properties: Dict

@dataclass
class Edge:
    """노드 간 관계"""
    source: str
    target: str
    rel_type: str

@dataclass
class FetchResult:
    """창고 응답 — 판단 없이 사실만 담는다"""
    documents: List[Document] = field(default_factory=list)
    edges: List[Edge] = field(default_factory=list)
    total_count: int = 0


# ═══════════════════════════════════════════════════════════════════════════════
# Warehouse API
# ═══════════════════════════════════════════════════════════════════════════════

class WarehouseAPI:
    """
    기계적 데이터 접근 계층.
    판단하지 않는다. 조건에 맞는 것을 꺼내줄 뿐이다.
    """

    def __init__(self, graph_path: str = "knowledge_graph_ontology.json"):
        self.nodes: Dict[str, Document] = {}
        self.edges: List[Edge] = []
        self.adj: Dict[str, List[Edge]] = {}       # source → edges
        self.rev_adj: Dict[str, List[Edge]] = {}    # target → edges
        self.taxonomy = {}
        self._load(graph_path)

    def _load(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.taxonomy = data.get("taxonomy", {})

        for node_data in data.get("graph_data", {}).get("nodes", []):
            doc = Document(
                id=node_data["id"],
                labels=node_data.get("labels", []),
                types=node_data.get("@type", []),
                properties=node_data.get("properties", {}),
            )
            self.nodes[doc.id] = doc

        for edge_data in data.get("graph_data", {}).get("edges", []):
            edge = Edge(
                source=edge_data["source"],
                target=edge_data["target"],
                rel_type=edge_data["type"],
            )
            self.edges.append(edge)
            self.adj.setdefault(edge.source, []).append(edge)
            self.rev_adj.setdefault(edge.target, []).append(edge)

    # ── 조건 검색: 조건에 맞는 문서를 전부 반환 ──

    def fetch_documents(
        self,
        carrier: Optional[str] = None,
        product: Optional[str] = None,
        doc_type: Optional[List[str]] = None,
        tier: Optional[str] = None,
    ) -> FetchResult:
        """조건 필터로 문서 검색. 빈 조건이면 해당 필터 무시."""
        results = []
        for doc in self.nodes.values():
            if "Document" not in doc.labels:
                continue

            props = doc.properties
            if carrier and props.get("carrier") != carrier:
                continue
            if product and props.get("product") != product:
                continue
            if doc_type and props.get("doc_type") not in doc_type:
                continue
            if tier and props.get("tier") != tier:
                continue

            results.append(doc)

        return FetchResult(documents=results, total_count=len(results))

    # ── 단건 조회: ID로 문서 1건 ──

    def fetch_document_by_id(self, doc_id: str) -> Optional[Document]:
        """ID로 단건 조회. 없으면 None."""
        return self.nodes.get(doc_id)

    # ── 엣지 탐색: 요청한 관계만 반환 ──

    def fetch_edges(
        self,
        node_id: str,
        edge_type: Optional[str] = None,
        direction: str = "outgoing",
    ) -> FetchResult:
        """
        노드의 엣지를 반환.
        direction: "outgoing", "incoming", "both"
        """
        edges = []

        if direction in ("outgoing", "both"):
            for e in self.adj.get(node_id, []):
                if edge_type is None or e.rel_type == edge_type:
                    edges.append(e)

        if direction in ("incoming", "both"):
            for e in self.rev_adj.get(node_id, []):
                if edge_type is None or e.rel_type == edge_type:
                    edges.append(e)

        return FetchResult(edges=edges, total_count=len(edges))

    # ── 이웃 탐색: 지정된 depth와 엣지 타입으로 기계적 탐색 ──

    def fetch_neighbors(
        self,
        node_id: str,
        depth: int = 1,
        edge_types: Optional[List[str]] = None,
        node_label: Optional[str] = None,
    ) -> FetchResult:
        """
        node_id에서 depth만큼 떨어진 이웃 노드를 반환.
        edge_types로 엣지 필터, node_label로 노드 필터.
        판단 없이 연결된 것을 그대로 반환.
        """
        visited: Set[str] = {node_id}
        current_level = {node_id}
        result_docs = []
        result_edges = []

        for d in range(depth):
            next_level = set()
            for nid in current_level:
                for e in self.adj.get(nid, []):
                    if edge_types and e.rel_type not in edge_types:
                        continue
                    if e.target not in visited:
                        visited.add(e.target)
                        next_level.add(e.target)
                        result_edges.append(e)

                for e in self.rev_adj.get(nid, []):
                    if edge_types and e.rel_type not in edge_types:
                        continue
                    if e.source not in visited:
                        visited.add(e.source)
                        next_level.add(e.source)
                        result_edges.append(e)

            current_level = next_level

        # 발견된 노드 중 필터 조건에 맞는 것만 반환
        for nid in visited - {node_id}:
            node = self.nodes.get(nid)
            if node is None:
                continue
            if node_label and node_label not in node.labels:
                continue
            result_docs.append(node)

        return FetchResult(
            documents=result_docs,
            edges=result_edges,
            total_count=len(result_docs),
        )

    # ── 프로세스 문서: 프로세스에 USED_IN으로 연결된 문서 ──

    def fetch_process_documents(self, process_id: str) -> FetchResult:
        """프로세스에 USED_IN 관계로 연결된 문서를 반환."""
        docs = []
        edges = []
        for e in self.rev_adj.get(process_id, []):
            if e.rel_type == "USED_IN":
                node = self.nodes.get(e.source)
                if node and "Document" in node.labels:
                    docs.append(node)
                    edges.append(e)

        return FetchResult(documents=docs, edges=edges, total_count=len(docs))

    # ── 개념 조회: 개념 노드 + 연결 관계 ──

    def fetch_concept(self, concept_id: str) -> Dict:
        """개념 노드의 관계를 구조적으로 반환. 판단 없이 연결된 그대로."""
        node = self.nodes.get(concept_id)
        if not node:
            return {"error": f"개념 '{concept_id}' 없음"}

        result = {
            "id": concept_id,
            "name": node.properties.get("name", ""),
            "description": node.properties.get("description", ""),
            "synonyms": node.properties.get("synonyms", []),
            "broader": [],
            "narrower": [],
            "related": [],
            "explains": [],
        }

        for e in self.adj.get(concept_id, []):
            if e.rel_type == "BROADER":
                result["broader"].append(e.target)
            elif e.rel_type == "NARROWER":
                result["narrower"].append(e.target)
            elif e.rel_type in ("RELATED_TO", "ANTONYM_OF"):
                result["related"].append({"id": e.target, "type": e.rel_type})
            elif e.rel_type == "EXPLAINS":
                result["explains"].append(e.target)

        return result

    # ── 프로세스 체인: PRECEDES 엣지를 순서대로 반환 ──

    def fetch_process_chain(self, start_id: str) -> List[str]:
        """PRECEDES 체인을 따라간 순서 반환. 판단 없이 엣지 순서대로."""
        chain = [start_id]
        current = start_id
        visited = {start_id}
        while True:
            next_edges = [e for e in self.adj.get(current, []) if e.rel_type == "PRECEDES"]
            if not next_edges:
                break
            next_id = next_edges[0].target
            if next_id in visited:
                break
            visited.add(next_id)
            chain.append(next_id)
            current = next_id
        return chain

    # ── 동의어 사전: 참조 데이터 제공 ──

    def fetch_thesaurus(self, keyword: str) -> List[str]:
        """키워드에 매핑된 문서유형 코드를 반환. 사전 조회일 뿐, 검색이 아님."""
        from taxonomy_ontology import SYNONYM_MAP
        return SYNONYM_MAP.get(keyword, [])

    # ── 규제 영향: 규제 노드에 연결된 관계를 그대로 반환 ──

    def fetch_regulation_impact(self, reg_id: str) -> Dict:
        """규제 노드의 GOVERNS/RESTRICTS 관계를 반환."""
        governed = []
        restricted = []
        for e in self.adj.get(reg_id, []):
            if e.rel_type == "GOVERNS":
                governed.append(e.target)
            elif e.rel_type == "RESTRICTS":
                restricted.append(e.target)

        return {"governed_processes": governed, "restricted_docs": restricted}

    # ── 통계 (디버그용) ──

    def stats(self) -> Dict:
        labels = {}
        for n in self.nodes.values():
            for l in n.labels:
                labels[l] = labels.get(l, 0) + 1

        edge_types = {}
        for e in self.edges:
            edge_types[e.rel_type] = edge_types.get(e.rel_type, 0) + 1

        return {
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "node_labels": labels,
            "edge_types": edge_types,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 테스트: 창고가 기계적으로 작동하는지 확인
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("Warehouse API — 기계적 데이터 접근 계층 테스트")
    print("=" * 60)

    w = WarehouseAPI()
    stats = w.stats()
    print(f"\n로드: {stats['total_nodes']}개 노드, {stats['total_edges']}개 엣지")

    # 테스트 1: 조건 검색
    result = w.fetch_documents(carrier="INS-SAMSUNG", doc_type=["DOC-COMMISSION"])
    print(f"\n[테스트1] INS-SAMSUNG + DOC-COMMISSION: {result.total_count}건")

    # 테스트 2: 엣지 탐색
    if result.documents:
        doc_id = result.documents[0].id
        edges = w.fetch_edges(doc_id, "SIBLINGS")
        print(f"[테스트2] {doc_id}의 SIBLINGS: {edges.total_count}건")

    # 테스트 3: 이웃 탐색
    if result.documents:
        neighbors = w.fetch_neighbors(
            doc_id, depth=1,
            edge_types=["SIBLINGS", "REFERENCES"],
            node_label="Document",
        )
        print(f"[테스트3] {doc_id}의 1촌 이웃(SIBLINGS+REFERENCES): {neighbors.total_count}건")

    # 테스트 4: 프로세스 문서
    proc_docs = w.fetch_process_documents("BIZ-SETTLE")
    print(f"[테스트4] BIZ-SETTLE 프로세스 문서: {proc_docs.total_count}건")

    # 테스트 5: 프로세스 체인
    chain = w.fetch_process_chain("BIZ-PROSPECT")
    print(f"[테스트5] 판매 프로세스 체인: {' → '.join(chain)}")

    # 테스트 6: 개념 조회
    concept = w.fetch_concept("CONCEPT-GROSS-PREMIUM")
    print(f"[테스트6] 보험료 개념: 하위={concept.get('narrower', [])}")

    # 테스트 7: 동의어 사전
    thesaurus = w.fetch_thesaurus("수수료")
    print(f"[테스트7] '수수료' → {thesaurus}")

    # 테스트 8: 규제 영향
    impact = w.fetch_regulation_impact("REG-20260701")
    print(f"[테스트8] 1200%룰: GOVERNS={impact['governed_processes']}, RESTRICTS={impact['restricted_docs']}")

    print(f"\n전체 테스트 완료")


if __name__ == "__main__":
    main()
