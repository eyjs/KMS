"""
온톨로지 기반 지식 그래프 생성기

기존 simulator_v2_extended.py를 확장하여:
- 노드에 @type (온톨로지 클래스) 부여
- 개념(Concept) 노드 추가
- 규제 → 문서/프로세스 관계 추가
- 프로세스 순서(PRECEDES) 관계 추가
"""

import json
import os
from datetime import datetime, timedelta

from taxonomy_v2_extended import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DEFAULT_RELATIONS, DATA_TIERS, REGULATION_TIMELINE,
)
from taxonomy_ontology import (
    CARRIER_CLASS_MAP, PRODUCT_CLASS_MAP, DOC_TYPE_CLASS_MAP,
    PROCESS_CLASS_MAP, CONCEPTS, SYNONYM_MAP, RELATION_TYPES,
)
from simulator_v2_extended import (
    SAMPLE_CARRIERS, SAMPLE_PRODUCTS, COMMON_DOC_TYPES,
    DOC_PROCESS_MAP, DOC_AUDIENCE_MAP, DOC_TEMPLATES,
    get_tier, get_source, generate_doc_id, generate_doc_content,
)


def generate_ontology_graph():
    """온톨로지 메타데이터가 포함된 지식 그래프 생성"""
    nodes = []
    edges = []

    # ── 루트 노드 ──
    nodes.append({
        "id": "ROOT-IFA-KNOWLEDGE",
        "labels": ["SystemRoot"],
        "@type": ["ga:Thing"],
        "properties": {
            "name": "iFA 지식체계 v3.0 (온톨로지)",
            "version": "3.0",
        }
    })

    # ── 보험사 노드 ──
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        nodes.append({
            "id": carrier_id,
            "labels": ["Carrier", carrier.get("type", "life")],
            "@type": CARRIER_CLASS_MAP.get(carrier_id, ["ga:Carrier"]),
            "properties": {
                "name": carrier.get("name", carrier_id),
                "alias": carrier.get("alias", []),
                "type": carrier.get("type", "life"),
                "tier": carrier.get("tier", "mid"),
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": carrier_id, "type": "HAS_CARRIER"})

    # ── 프로세스 노드 + 순서 관계 ──
    process_order = [
        "BIZ-PROSPECT", "BIZ-CONSULT", "BIZ-UW", "BIZ-ISSUE",
        "BIZ-HAPPYCALL", "BIZ-MAINTAIN", "BIZ-CLAIM",
    ]
    for proc_id, proc in PROCESSES.items():
        nodes.append({
            "id": proc_id,
            "labels": ["Process"],
            "@type": PROCESS_CLASS_MAP.get(proc_id, ["ga:BusinessProcess"]),
            "properties": {
                "name": proc.get("name", proc_id),
                "order": proc.get("order", 99),
                "description": proc.get("description", ""),
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": proc_id, "type": "HAS_PROCESS"})

    # 판매 프로세스 순서 관계
    for i in range(len(process_order) - 1):
        edges.append({"source": process_order[i], "target": process_order[i+1], "type": "PRECEDES"})

    # 정산 프로세스 관계
    edges.append({"source": "BIZ-ISSUE", "target": "BIZ-SETTLE", "type": "PRECEDES"})

    # ── 공통 문서 노드 ──
    for doc_type_id in COMMON_DOC_TYPES:
        if doc_type_id not in DOC_TYPES:
            continue
        doc_type = DOC_TYPES[doc_type_id]
        doc_id = generate_doc_id(doc_type_id)
        tier = get_tier(doc_type_id)

        nodes.append({
            "id": doc_id,
            "labels": ["Document", doc_type_id, tier, "COMMON"],
            "@type": DOC_TYPE_CLASS_MAP.get(doc_type_id, ["ga:DocumentType"]),
            "properties": {
                "name": doc_type.get("name", doc_type_id),
                "carrier": "INS-COMMON",
                "product": "PRD-COMMON",
                "doc_type": doc_type_id,
                "tier": tier,
                "source": get_source(doc_type_id),
                "processes": DOC_PROCESS_MAP.get(doc_type_id, ["BIZ-COMMON"]),
                "audiences": DOC_AUDIENCE_MAP.get(doc_type_id, ["AUD-ALL"]),
                "status": "active",
                "version": "1.0",
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": doc_id, "type": "HAS_COMMON_DOC"})

        # 문서 → 프로세스 USED_IN
        for proc_id in DOC_PROCESS_MAP.get(doc_type_id, []):
            edges.append({"source": doc_id, "target": proc_id, "type": "USED_IN"})

    # ── 상품별 문서 노드 ──
    doc_count = 0
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        products = SAMPLE_PRODUCTS["non-life"] if carrier_type == "non-life" else SAMPLE_PRODUCTS["life"]

        for product_id in products:
            product = PRODUCTS.get(product_id, {})
            product_node_id = f"{carrier_id}-{product_id}"

            # 상품 노드
            nodes.append({
                "id": product_node_id,
                "labels": ["Product", carrier_id, product.get("category", "COMMON")],
                "@type": PRODUCT_CLASS_MAP.get(product_id, ["ga:Product"]),
                "properties": {
                    "name": f"{carrier.get('name', '')} {product.get('name', '')}",
                    "carrier": carrier_id,
                    "product": product_id,
                    "category": product.get("category", "COMMON"),
                }
            })
            edges.append({"source": carrier_id, "target": product_node_id, "type": "OFFERS"})

            # 문서 노드
            for doc_type_id, doc_type in DOC_TYPES.items():
                if doc_type_id in COMMON_DOC_TYPES:
                    continue

                doc_id = generate_doc_id(doc_type_id, carrier_id, product_id)
                tier = doc_type.get("tier", "WARM")

                today = datetime.now()
                valid_from = today.strftime("%Y-%m-01") if tier == "HOT" else (today - timedelta(days=90)).strftime("%Y-%m-%d")
                valid_to = (today + timedelta(days=30)).strftime("%Y-%m-%d") if tier == "HOT" else None

                nodes.append({
                    "id": doc_id,
                    "labels": ["Document", doc_type_id, tier],
                    "@type": DOC_TYPE_CLASS_MAP.get(doc_type_id, ["ga:DocumentType"]),
                    "properties": {
                        "name": f"{carrier.get('name', '')} {product.get('name', '')} {doc_type.get('name', '')}",
                        "carrier": carrier_id,
                        "product": product_id,
                        "doc_type": doc_type_id,
                        "tier": tier,
                        "source": doc_type.get("source", "ga"),
                        "processes": DOC_PROCESS_MAP.get(doc_type_id, ["BIZ-COMMON"]),
                        "audiences": DOC_AUDIENCE_MAP.get(doc_type_id, ["AUD-ALL"]),
                        "status": "active",
                        "valid_from": valid_from,
                        "valid_to": valid_to,
                        "version": "1.0",
                    }
                })
                edges.append({"source": product_node_id, "target": doc_id, "type": "HAS_DOCUMENT"})
                doc_count += 1

                # 문서 → 프로세스 USED_IN
                for proc_id in DOC_PROCESS_MAP.get(doc_type_id, []):
                    edges.append({"source": doc_id, "target": proc_id, "type": "USED_IN"})

                # 문서 간 관계
                relations = DEFAULT_RELATIONS.get(doc_type_id, {})
                for rel_type, targets in relations.items():
                    for target_doc_type in targets:
                        if target_doc_type in COMMON_DOC_TYPES:
                            target_id = generate_doc_id(target_doc_type)
                        else:
                            target_id = generate_doc_id(target_doc_type, carrier_id, product_id)
                        edges.append({"source": doc_id, "target": target_id, "type": rel_type})
                        if rel_type == "SIBLINGS":
                            edges.append({"source": target_id, "target": doc_id, "type": rel_type})

    # ── 규제 이벤트 노드 + 관계 ──
    for reg in REGULATION_TIMELINE:
        reg_id = f"REG-{reg['date'].replace('-', '')}"
        nodes.append({
            "id": reg_id,
            "labels": ["Regulation", reg.get("status", "upcoming")],
            "@type": ["ga:Regulation", "ga:RegulationEvent"],
            "properties": {
                "name": reg["name"],
                "date": reg["date"],
                "description": reg.get("description", ""),
                "status": reg.get("status", "upcoming"),
                "impact": reg.get("impact", ""),
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": reg_id, "type": "HAS_REGULATION"})

    # 1200%룰 → 수수료 관련 문서/프로세스 GOVERNS
    rule_1200_id = "REG-20260701"
    edges.append({"source": rule_1200_id, "target": "BIZ-SETTLE", "type": "GOVERNS"})
    # 분급제 → 정산
    installment_id = "REG-20270101"
    edges.append({"source": installment_id, "target": "BIZ-SETTLE", "type": "GOVERNS"})

    # 규제 → 관련 COMMON 문서 RESTRICTS
    for doc_type_id in ["DOC-REGULATION", "DOC-COMMISSION-CALC"]:
        doc_id = generate_doc_id(doc_type_id) if doc_type_id in COMMON_DOC_TYPES else None
        if doc_id:
            edges.append({"source": rule_1200_id, "target": doc_id, "type": "RESTRICTS"})
            edges.append({"source": installment_id, "target": doc_id, "type": "RESTRICTS"})

    # ── 개념(Concept) 노드 ──
    for concept_id, concept in CONCEPTS.items():
        nodes.append({
            "id": concept_id,
            "labels": ["Concept"],
            "@type": ["ga:Concept", concept.get("class", "ga:Concept")],
            "properties": {
                "name": concept["name"],
                "synonyms": concept.get("synonyms", []),
                "description": concept.get("description", ""),
            }
        })

        # 개념 → 개념 (BROADER/NARROWER)
        if "broader" in concept:
            edges.append({"source": concept_id, "target": concept["broader"], "type": "BROADER"})
            edges.append({"source": concept["broader"], "target": concept_id, "type": "NARROWER"})
        for narrower_id in concept.get("narrower", []):
            edges.append({"source": concept_id, "target": narrower_id, "type": "NARROWER"})
            edges.append({"source": narrower_id, "target": concept_id, "type": "BROADER"})

        # 개념 → 문서 EXPLAINS
        for doc_type_id in concept.get("related_docs", []):
            if doc_type_id in COMMON_DOC_TYPES:
                target_doc_id = generate_doc_id(doc_type_id)
                edges.append({"source": concept_id, "target": target_doc_id, "type": "EXPLAINS"})
            else:
                # 비공통 문서는 이미 생성된 노드 중 해당 유형 문서에 연결
                for n in nodes:
                    if "Document" in n.get("labels", []) and n["properties"].get("doc_type") == doc_type_id:
                        edges.append({"source": concept_id, "target": n["id"], "type": "EXPLAINS"})
                        break  # 대표 1개만 연결

        # 개념 ↔ 개념 RELATED_TO
        for related_id in concept.get("related_concepts", []):
            edges.append({"source": concept_id, "target": related_id, "type": "RELATED_TO"})

        # 반의어
        if "antonym" in concept:
            edges.append({"source": concept_id, "target": concept["antonym"], "type": "ANTONYM_OF"})

    # ── 통계 ──
    concept_count = sum(1 for n in nodes if "Concept" in n["labels"])
    process_count = sum(1 for n in nodes if "Process" in n["labels"])
    regulation_count = sum(1 for n in nodes if "Regulation" in n["labels"])

    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "carriers": len(SAMPLE_CARRIERS),
        "common_docs": len(COMMON_DOC_TYPES),
        "doc_types": len(DOC_TYPES),
        "documents": doc_count + len(COMMON_DOC_TYPES),
        "concepts": concept_count,
        "processes": process_count,
        "regulations": regulation_count,
        "version": "3.0-ontology",
        "generated_at": datetime.now().isoformat(),
    }

    # taxonomy 정보 포함 (RAG 시뮬레이터에서 참조)
    taxonomy = {
        "doc_types": {k: {"name": v.get("name", k)} for k, v in DOC_TYPES.items()},
        "processes": {k: {"name": v.get("name", k)} for k, v in PROCESSES.items()},
        "carriers": {k: {"name": v.get("name", k), "alias": v.get("alias", [])} for k, v in CARRIERS.items()},
    }

    return {
        "stats": stats,
        "taxonomy": taxonomy,
        "graph_data": {"nodes": nodes, "edges": edges},
    }


def main():
    print("=" * 60)
    print("온톨로지 기반 지식 그래프 생성기 v3.0")
    print("=" * 60)

    graph_data = generate_ontology_graph()

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_graph_ontology.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)

    stats = graph_data["stats"]
    print(f"\n  노드: {stats['total_nodes']}개")
    print(f"  엣지: {stats['total_edges']}개")
    print(f"  문서: {stats['documents']}개")
    print(f"  개념: {stats['concepts']}개")
    print(f"  프로세스: {stats['processes']}개")
    print(f"  규제: {stats['regulations']}개")
    print(f"\n  저장: {output_path}")


if __name__ == "__main__":
    main()
