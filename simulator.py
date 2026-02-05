"""
iFA 지식체계 시뮬레이터
- 3-Axis Taxonomy 기반 문서 생성
- MD 파일 + YAML Frontmatter 출력
- Knowledge Graph JSON 생성
"""

import json
import os
from datetime import date
from taxonomy import CARRIERS, PRODUCTS, DOC_TYPES, RELATIONS, DOC_TEMPLATES


def generate_doc_id(carrier: str, product: str, doc_type: str) -> str:
    """문서 ID 생성: DOC-{보험사}-{상품}-{문서유형}-001"""
    return f"{doc_type}-{carrier}-{product}-001"


def get_related_docs(carrier: str, product: str, doc_type: str) -> list[str]:
    """해당 문서와 연결된 문서 ID 목록 반환"""
    related = []
    if doc_type in RELATIONS:
        for related_type in RELATIONS[doc_type]:
            related.append(generate_doc_id(carrier, product, related_type))
    return related


def generate_frontmatter(carrier: str, product: str, doc_type: str) -> str:
    """YAML Frontmatter 생성"""
    doc_id = generate_doc_id(carrier, product, doc_type)
    doc_info = DOC_TYPES[doc_type]
    carrier_info = CARRIERS[carrier]
    product_info = PRODUCTS[product]
    related = get_related_docs(carrier, product, doc_type)

    today = date.today().isoformat()

    lines = [
        "---",
        f"id: {doc_id}",
        f"carrier: {carrier}",
        f"carrier_name: {carrier_info['name']}",
        f"product: {product}",
        f"product_name: {product_info['name']}",
        f"doc_type: {doc_type}",
        f"doc_type_name: {doc_info['name']}",
        f"tier: {doc_info['tier']}",
        f"status: ACTIVE",
        f"effective_date: {today}",
        f"expiry_date: null",
        f"version: 1.0",
    ]

    if related:
        lines.append("related:")
        for r in related:
            lines.append(f"  - {r}")

    lines.append("---")
    return "\n".join(lines)


def generate_content(carrier: str, product: str, doc_type: str) -> str:
    """문서 본문 생성"""
    carrier_info = CARRIERS[carrier]
    product_info = PRODUCTS[product]
    doc_info = DOC_TYPES[doc_type]
    today = date.today().isoformat()

    title = f"# {carrier_info['name']} {product_info['name']} {doc_info['name']}"

    template = DOC_TEMPLATES.get(doc_type, "")
    content = template.format(
        carrier_name=carrier_info['name'],
        product_name=product_info['name'],
        effective_date=today,
        expiry_date="2025-12-31",
    )

    return f"{title}\n{content}"


def generate_md_file(carrier: str, product: str, doc_type: str, base_dir: str) -> str:
    """MD 파일 생성 및 저장"""
    frontmatter = generate_frontmatter(carrier, product, doc_type)
    content = generate_content(carrier, product, doc_type)

    full_content = f"{frontmatter}\n\n{content}"

    dir_path = os.path.join(base_dir, carrier, product)
    os.makedirs(dir_path, exist_ok=True)

    file_path = os.path.join(dir_path, f"{doc_type}.md")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(full_content)

    return file_path


def build_knowledge_graph(docs: list[dict]) -> dict:
    """Knowledge Graph JSON 생성"""
    nodes = []
    edges = []

    # 루트 노드
    root_id = "ROOT-IFA-KNOWLEDGE"
    nodes.append({
        "id": root_id,
        "labels": ["SystemRoot"],
        "properties": {"name": "iFA 지식체계", "description": "보험 설계사 지식 관리 시스템"}
    })

    # 보험사 노드
    for carrier_id, carrier_info in CARRIERS.items():
        nodes.append({
            "id": carrier_id,
            "labels": ["Carrier"],
            "properties": {"name": carrier_info['name'], "alias": carrier_info['alias']}
        })
        edges.append({"source": root_id, "target": carrier_id, "relationship": "HAS_CARRIER"})

    # 상품 노드 (보험사별)
    product_nodes = set()
    for doc in docs:
        product_node_id = f"{doc['carrier']}-{doc['product']}"
        if product_node_id not in product_nodes:
            product_nodes.add(product_node_id)
            product_info = PRODUCTS[doc['product']]
            nodes.append({
                "id": product_node_id,
                "labels": ["Product", doc['carrier']],
                "properties": {
                    "name": f"{CARRIERS[doc['carrier']]['name']} {product_info['name']}",
                    "category": product_info['category']
                }
            })
            edges.append({
                "source": doc['carrier'],
                "target": product_node_id,
                "relationship": "OFFERS_PRODUCT"
            })

    # 문서 노드 및 관계
    for doc in docs:
        doc_info = DOC_TYPES[doc['doc_type']]
        product_node_id = f"{doc['carrier']}-{doc['product']}"

        nodes.append({
            "id": doc['id'],
            "labels": ["Document", doc['doc_type'], doc_info['tier']],
            "properties": {
                "name": f"{CARRIERS[doc['carrier']]['name']} {PRODUCTS[doc['product']]['name']} {doc_info['name']}",
                "carrier": doc['carrier'],
                "product": doc['product'],
                "tier": doc_info['tier'],
                "file_path": doc['file_path']
            }
        })

        # 상품 -> 문서 연결
        edges.append({
            "source": product_node_id,
            "target": doc['id'],
            "relationship": "HAS_DOCUMENT"
        })

        # 문서 간 연결
        for related_id in doc['related']:
            edges.append({
                "source": doc['id'],
                "target": related_id,
                "relationship": "RELATED_TO"
            })

    return {
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "carriers": len(CARRIERS),
            "products": len(PRODUCTS),
            "doc_types": len(DOC_TYPES),
            "documents": len(docs)
        },
        "graph_data": {"nodes": nodes, "edges": edges}
    }


def main():
    base_dir = os.path.join(os.path.dirname(__file__), "docs")
    docs = []

    print("\n" + "=" * 50)
    print(" iFA 지식체계 시뮬레이터 실행")
    print("=" * 50)

    # 3-Axis 조합으로 문서 생성
    for carrier in CARRIERS:
        for product in PRODUCTS:
            for doc_type in DOC_TYPES:
                doc_id = generate_doc_id(carrier, product, doc_type)
                related = get_related_docs(carrier, product, doc_type)
                file_path = generate_md_file(carrier, product, doc_type, base_dir)

                docs.append({
                    "id": doc_id,
                    "carrier": carrier,
                    "product": product,
                    "doc_type": doc_type,
                    "related": related,
                    "file_path": file_path.replace("\\", "/")
                })
                print(f"  [OK] {file_path}")

    # Knowledge Graph 생성
    graph = build_knowledge_graph(docs)

    output_file = os.path.join(os.path.dirname(__file__), "knowledge_graph.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)

    # 결과 출력
    print("\n" + "-" * 50)
    print(f" 생성 완료: {output_file}")
    print("-" * 50)
    print(f"  - 보험사: {graph['stats']['carriers']}개")
    print(f"  - 상품군: {graph['stats']['products']}개")
    print(f"  - 문서유형: {graph['stats']['doc_types']}개")
    print(f"  - 총 문서: {graph['stats']['documents']}개")
    print(f"  - 노드: {graph['stats']['total_nodes']}개")
    print(f"  - 엣지: {graph['stats']['total_edges']}개")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
