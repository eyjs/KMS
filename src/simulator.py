"""
KMS v3.0 샘플 데이터 생성기

프레임워크 구조 반영:
- 문서에 domain, lifecycle, version(객체), reviewedAt, classification, meta 필드 추가
- 라이프사이클 상태 분배 (ACTIVE 80%, STALE 10%, DRAFT 5%, DEPRECATED 5%)
- 신선도 테스트를 위한 날짜 분산
"""

import json
import os
import random
from datetime import datetime, timedelta
from taxonomy import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DEFAULT_RELATIONS, DATA_TIERS, CERTIFICATIONS, GA_TYPES,
    REGULATION_TIMELINE, COMMISSION_TYPES, CHARGEBACK_RULES, KPI_METRICS,
    SYSTEM_CONFIG, BUSINESSES, DOMAINS, DOC_TYPE_DOMAIN_MAP
)

random.seed(42)

# 전체 보험사 (공통 제외)
SAMPLE_CARRIERS = [k for k in CARRIERS.keys() if k != "INS-COMMON"]

# 카테고리별 전체 상품 (공통/버전 상품 제외)
SAMPLE_PRODUCTS = {
    "life": [p for p, v in PRODUCTS.items()
             if v.get("category") in ("LIFE", "HEALTH", "ANNUITY")
             and p != "PRD-COMMON" and not v.get("supersedes")],
    "non-life": [p for p, v in PRODUCTS.items()
                 if v.get("category") in ("NON-LIFE", "HEALTH")
                 and p != "PRD-COMMON" and not v.get("supersedes")],
}

# 버전/개편 상품 (메이저 보험사만)
VERSIONED_PRODUCTS = {
    "life": [p for p, v in PRODUCTS.items() if v.get("supersedes") and v.get("category") in ("LIFE", "HEALTH", "ANNUITY")],
    "non-life": [p for p, v in PRODUCTS.items() if v.get("supersedes") and v.get("category") in ("NON-LIFE", "HEALTH")],
}

MAJOR_CARRIERS = [k for k, v in CARRIERS.items() if v.get("tier") == "major"]

# 공통 문서 (보험사/상품 무관)
COMMON_DOC_TYPES = [
    "DOC-LAW-INSURANCE", "DOC-LAW-CONSUMER", "DOC-REGULATION",
    "DOC-COMPLIANCE-GUIDE", "DOC-ONBOARDING", "DOC-CERTIFICATION",
    "DOC-SYSTEM-MANUAL", "DOC-FAQ",
]

# 문서유형별 프로세스 매핑
DOC_PROCESS_MAP = {
    "DOC-TERMS": ["BIZ-CONSULT"],
    "DOC-GUIDE": ["BIZ-CONSULT"],
    "DOC-SCRIPT": ["BIZ-CONSULT"],
    "DOC-COMPARISON": ["BIZ-CONSULT"],
    "DOC-PROPOSAL": ["BIZ-CONSULT"],
    "DOC-RATE-TABLE": ["BIZ-CONSULT", "BIZ-SETTLE"],
    "DOC-INCENTIVE": ["BIZ-SETTLE"],
    "DOC-COMMISSION": ["BIZ-SETTLE"],
    "DOC-COMMISSION-CALC": ["BIZ-SETTLE"],
    "DOC-APPLICATION": ["BIZ-CONSULT"],
    "DOC-DISCLOSURE": ["BIZ-CONSULT"],
    "DOC-CONFIRMATION": ["BIZ-CONSULT"],
    "DOC-CUSTOMER-CARD": ["BIZ-CONSULT", "BIZ-MAINTAIN"],
    "DOC-NEEDS-ANALYSIS": ["BIZ-CONSULT"],
    "DOC-UW-GUIDE": ["BIZ-UW"],
    "DOC-UW-RULE": ["BIZ-UW"],
    "DOC-UW-DISEASE": ["BIZ-UW"],
    "DOC-UW-JOB": ["BIZ-UW"],
    "DOC-EXCLUSION": ["BIZ-UW", "BIZ-CLAIM"],
    "DOC-LAW-INSURANCE": ["BIZ-COMPLIANCE"],
    "DOC-LAW-CONSUMER": ["BIZ-COMPLIANCE"],
    "DOC-REGULATION": ["BIZ-COMPLIANCE"],
    "DOC-COMPLIANCE-GUIDE": ["BIZ-COMPLIANCE"],
    "DOC-TRAINING": ["BIZ-EDUCATION"],
    "DOC-ONBOARDING": ["BIZ-EDUCATION", "BIZ-RECRUIT"],
    "DOC-COMPLIANCE": ["BIZ-EDUCATION", "BIZ-COMPLIANCE"],
    "DOC-CERTIFICATION": ["BIZ-EDUCATION"],
    "DOC-SETTLEMENT": ["BIZ-SETTLE"],
    "DOC-PERFORMANCE": ["BIZ-SETTLE"],
    "DOC-CHARGEBACK": ["BIZ-SETTLE"],
    "DOC-NOTICE": ["BIZ-COMMON"],
    "DOC-INTERNAL-MEMO": ["BIZ-COMMON"],
    "DOC-BEST-PRACTICE": ["BIZ-CONSULT", "BIZ-UW"],
    "DOC-EXPERT-TIP": ["BIZ-CONSULT"],
    "DOC-CASE-STUDY": ["BIZ-CONSULT", "BIZ-UW"],
    "DOC-FAQ": ["BIZ-COMMON"],
}

DOC_AUDIENCE_MAP = {
    "DOC-TERMS": ["AUD-ALL"],
    "DOC-GUIDE": ["AUD-AGENT"],
    "DOC-SCRIPT": ["AUD-AGENT", "AUD-AGENT-NEW"],
    "DOC-COMPARISON": ["AUD-AGENT"],
    "DOC-PROPOSAL": ["AUD-AGENT"],
    "DOC-RATE-TABLE": ["AUD-AGENT"],
    "DOC-INCENTIVE": ["AUD-AGENT"],
    "DOC-COMMISSION": ["AUD-AGENT", "AUD-MANAGER"],
    "DOC-COMMISSION-CALC": ["AUD-MANAGER", "AUD-COMPLIANCE"],
    "DOC-APPLICATION": ["AUD-AGENT"],
    "DOC-DISCLOSURE": ["AUD-AGENT"],
    "DOC-CONFIRMATION": ["AUD-AGENT"],
    "DOC-CUSTOMER-CARD": ["AUD-AGENT"],
    "DOC-NEEDS-ANALYSIS": ["AUD-AGENT", "AUD-AGENT-NEW"],
    "DOC-UW-GUIDE": ["AUD-UW", "AUD-AGENT-SENIOR"],
    "DOC-UW-RULE": ["AUD-UW"],
    "DOC-UW-DISEASE": ["AUD-UW"],
    "DOC-UW-JOB": ["AUD-UW"],
    "DOC-EXCLUSION": ["AUD-UW", "AUD-AGENT"],
    "DOC-LAW-INSURANCE": ["AUD-ALL"],
    "DOC-LAW-CONSUMER": ["AUD-ALL"],
    "DOC-REGULATION": ["AUD-MANAGER", "AUD-COMPLIANCE"],
    "DOC-COMPLIANCE-GUIDE": ["AUD-ALL"],
    "DOC-TRAINING": ["AUD-AGENT"],
    "DOC-ONBOARDING": ["AUD-AGENT-NEW"],
    "DOC-COMPLIANCE": ["AUD-ALL"],
    "DOC-CERTIFICATION": ["AUD-AGENT"],
    "DOC-SETTLEMENT": ["AUD-MANAGER"],
    "DOC-PERFORMANCE": ["AUD-MANAGER", "AUD-BRANCH-MGR"],
    "DOC-CHARGEBACK": ["AUD-AGENT", "AUD-MANAGER"],
    "DOC-NOTICE": ["AUD-ALL"],
    "DOC-INTERNAL-MEMO": ["AUD-ALL"],
    "DOC-BEST-PRACTICE": ["AUD-AGENT-SENIOR"],
    "DOC-EXPERT-TIP": ["AUD-AGENT"],
    "DOC-CASE-STUDY": ["AUD-AGENT"],
    "DOC-FAQ": ["AUD-ALL"],
}


# 문서 내용 템플릿 (기존 유지)
DOC_TEMPLATES = {
    "DOC-LAW-INSURANCE": "# 보험업법 주요 조항\n\n## 제87조 (모집할 수 있는 자)\n보험설계사, 보험대리점, 보험중개사 등록 요건\n\n## 제97조 (모집질서유지)\n부당 승환계약 금지",
    "DOC-LAW-CONSUMER": "# 금융소비자보호법 6대 판매원칙\n\n## 1. 적합성 원칙 (제17조)\n## 2. 적정성 원칙 (제18조)\n## 3. 설명의무 (제19조)\n## 4. 불공정영업행위 금지 (제20조)",
    "DOC-REGULATION": "# 감독규정 및 규제 일정\n\n## 현행 규제\n- 1200%룰: 초년도 모집수수료 월납 보험료의 12배 이내",
}


def get_tier(doc_type: str) -> str:
    return DOC_TYPES.get(doc_type, {}).get("tier", "WARM")


def get_source(doc_type: str) -> str:
    return DOC_TYPES.get(doc_type, {}).get("source", "ga")


def generate_doc_id(doc_type: str, carrier: str = None, product: str = None, seq: int = 1) -> str:
    if carrier and product:
        return f"{doc_type}-{carrier}-{product}-{seq:03d}"
    elif carrier:
        return f"{doc_type}-{carrier}-{seq:03d}"
    else:
        return f"{doc_type}-COMMON-{seq:03d}"


def generate_doc_content(doc_type: str, carrier: str = None, product: str = None) -> str:
    try:
        from doc_templates import get_template
        carrier_name = CARRIERS.get(carrier, {}).get("name", "공통") if carrier else "공통"
        product_name = PRODUCTS.get(product, {}).get("name", "공통") if product else "공통"
        return get_template(doc_type, carrier_name, product_name)
    except Exception:
        carrier_name = CARRIERS.get(carrier, {}).get("name", "공통") if carrier else "공통"
        product_name = PRODUCTS.get(product, {}).get("name", "공통") if product else "공통"
        doc_type_name = DOC_TYPES.get(doc_type, {}).get("name", doc_type)
        return f"# {carrier_name} {product_name} {doc_type_name}\n\n## 개요\n{carrier_name}의 {product_name} 관련 {doc_type_name}입니다.\n"


def random_lifecycle():
    """라이프사이클 상태 분배: ACTIVE 80%, STALE 10%, DRAFT 5%, DEPRECATED 5%"""
    r = random.random()
    if r < 0.80:
        return "ACTIVE"
    elif r < 0.90:
        return "STALE"
    elif r < 0.95:
        return "DRAFT"
    else:
        return "DEPRECATED"


def random_dates(tier: str, lifecycle: str):
    """신선도 테스트를 위한 날짜 분산 생성"""
    today = datetime.now()
    max_days = SYSTEM_CONFIG["freshness_defaults"].get(tier, 90)

    # 생성일: 30~365일 전
    created_days_ago = random.randint(30, 365)
    created_at = today - timedelta(days=created_days_ago)

    if lifecycle == "ACTIVE":
        # ACTIVE: updatedAt을 최근으로 (신선한 상태와 만료 임박 섞음)
        updated_days_ago = random.randint(0, int(max_days * 1.2))
        updated_at = today - timedelta(days=updated_days_ago)
        reviewed_at = updated_at + timedelta(days=random.randint(0, 3))
    elif lifecycle == "STALE":
        # STALE: updatedAt이 maxDays 초과 (만료 상태)
        updated_days_ago = random.randint(int(max_days * 1.1), int(max_days * 2))
        updated_at = today - timedelta(days=updated_days_ago)
        reviewed_at = updated_at
    elif lifecycle == "DRAFT":
        updated_at = created_at + timedelta(days=random.randint(0, 5))
        reviewed_at = None
    else:  # DEPRECATED
        updated_days_ago = random.randint(int(max_days * 1.5), int(max_days * 3))
        updated_at = today - timedelta(days=updated_days_ago)
        reviewed_at = updated_at

    return (
        created_at.isoformat(),
        updated_at.isoformat(),
        reviewed_at.isoformat() if reviewed_at else None,
    )


def generate_graph_data():
    """v3.0 그래프 데이터 생성 (프레임워크 구조 반영)"""
    nodes = []
    edges = []

    nodes.append({
        "id": "ROOT-IFA-KNOWLEDGE",
        "labels": ["SystemRoot"],
        "properties": {
            "name": "iFA 지식체계 v3.0",
            "description": "문서관리 프레임워크 + GA 도메인",
            "version": "3.0"
        }
    })

    # 보험사 노드
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        nodes.append({
            "id": carrier_id,
            "labels": ["Carrier", carrier.get("type", "life")],
            "properties": {
                "name": carrier.get("name", carrier_id),
                "alias": carrier.get("alias", []),
                "type": carrier.get("type", "life"),
                "tier": carrier.get("tier", "mid")
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": carrier_id, "type": "HAS_CARRIER"})

    # 공통 문서 노드
    for doc_type_id in COMMON_DOC_TYPES:
        if doc_type_id not in DOC_TYPES:
            continue
        doc_type = DOC_TYPES[doc_type_id]
        doc_id = generate_doc_id(doc_type_id)
        tier = get_tier(doc_type_id)
        domain = DOC_TYPE_DOMAIN_MAP.get(doc_type_id, "GA-SALES")
        lifecycle = random_lifecycle()
        created_at, updated_at, reviewed_at = random_dates(tier, lifecycle)
        is_versioned = False
        version = {"major": 1, "minor": 0}

        nodes.append({
            "id": doc_id,
            "labels": ["Document", doc_type_id, tier, "COMMON"],
            "properties": {
                "name": doc_type.get("name", doc_type_id),
                "domain": domain,
                "lifecycle": lifecycle,
                "version": version,
                "classification": {
                    "carrier": "INS-COMMON",
                    "product": "PRD-COMMON",
                    "docType": doc_type_id,
                },
                "meta": {
                    "process": DOC_PROCESS_MAP.get(doc_type_id, ["BIZ-COMMON"])[0],
                    "audience": DOC_AUDIENCE_MAP.get(doc_type_id, ["AUD-ALL"])[0],
                },
                "tier": tier,
                "source": get_source(doc_type_id),
                "createdAt": created_at,
                "updatedAt": updated_at,
                "reviewedAt": reviewed_at,
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": doc_id, "type": "HAS_COMMON_DOC"})

    def add_product_docs(carrier_id, carrier, product_id, product, nodes, edges):
        count = 0
        product_node_id = f"{carrier_id}-{product_id}"
        is_versioned_product = bool(product.get("supersedes"))

        nodes.append({
            "id": product_node_id,
            "labels": ["Product", carrier_id, product.get("category", "COMMON")],
            "properties": {
                "name": f"{carrier.get('name', '')} {product.get('name', '')}",
                "carrier": carrier_id,
                "product": product_id,
                "category": product.get("category", "COMMON")
            }
        })
        edges.append({"source": carrier_id, "target": product_node_id, "type": "OFFERS"})

        supersedes = product.get("supersedes")
        if supersedes:
            old_product_node_id = f"{carrier_id}-{supersedes}"
            edges.append({"source": product_node_id, "target": old_product_node_id, "type": "SUPERSEDES"})

        for doc_type_id, doc_type in DOC_TYPES.items():
            if doc_type_id in COMMON_DOC_TYPES:
                continue

            doc_id = generate_doc_id(doc_type_id, carrier_id, product_id)
            tier = doc_type.get("tier", "WARM")
            domain = DOC_TYPE_DOMAIN_MAP.get(doc_type_id, "GA-SALES")
            lifecycle = random_lifecycle()
            created_at, updated_at, reviewed_at = random_dates(tier, lifecycle)

            # 버전 상품 문서는 v2.0
            version = {"major": 2, "minor": 0} if is_versioned_product else {"major": 1, "minor": 0}

            nodes.append({
                "id": doc_id,
                "labels": ["Document", doc_type_id, tier],
                "properties": {
                    "name": f"{carrier.get('name', '')} {product.get('name', '')} {doc_type.get('name', '')}",
                    "domain": domain,
                    "lifecycle": lifecycle,
                    "version": version,
                    "classification": {
                        "carrier": carrier_id,
                        "product": product_id,
                        "docType": doc_type_id,
                    },
                    "meta": {
                        "process": DOC_PROCESS_MAP.get(doc_type_id, ["BIZ-COMMON"])[0],
                        "audience": DOC_AUDIENCE_MAP.get(doc_type_id, ["AUD-ALL"])[0],
                    },
                    "tier": tier,
                    "source": doc_type.get("source", "ga"),
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "reviewedAt": reviewed_at,
                }
            })
            edges.append({"source": product_node_id, "target": doc_id, "type": "HAS_DOCUMENT"})
            count += 1

            # 관계 추가
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

            # SUPERSEDES 관계: 버전 상품 문서 → 기존 상품 동일 문서유형
            if supersedes:
                old_doc_id = generate_doc_id(doc_type_id, carrier_id, supersedes)
                edges.append({"source": doc_id, "target": old_doc_id, "type": "SUPERSEDES"})

        return count

    doc_count = 0
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        is_major = carrier.get("tier") == "major"

        products = SAMPLE_PRODUCTS["non-life"] if carrier_type == "non-life" else SAMPLE_PRODUCTS["life"]
        for product_id in products:
            product = PRODUCTS.get(product_id, {})
            doc_count += add_product_docs(carrier_id, carrier, product_id, product, nodes, edges)

        if is_major:
            versioned = VERSIONED_PRODUCTS["non-life"] if carrier_type == "non-life" else VERSIONED_PRODUCTS["life"]
            for product_id in versioned:
                product = PRODUCTS.get(product_id, {})
                doc_count += add_product_docs(carrier_id, carrier, product_id, product, nodes, edges)

    # 규제 일정 노드
    for reg in REGULATION_TIMELINE:
        reg_id = f"REG-{reg['date'].replace('-', '')}"
        nodes.append({
            "id": reg_id,
            "labels": ["Regulation", reg.get("status", "upcoming")],
            "properties": reg
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": reg_id, "type": "HAS_REGULATION"})

    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "carriers": len(SAMPLE_CARRIERS),
        "common_docs": len(COMMON_DOC_TYPES),
        "doc_types": len(DOC_TYPES),
        "documents": doc_count + len(COMMON_DOC_TYPES),
        "regulations": len(REGULATION_TIMELINE),
        "version": "3.0",
        "generated_at": datetime.now().isoformat()
    }

    return {"stats": stats, "graph_data": {"nodes": nodes, "edges": edges}}


def generate_sample_files(base_path: str):
    """샘플 파일 생성"""
    samples_path = os.path.join(base_path, "data", "samples")
    common_path = os.path.join(samples_path, "COMMON")
    os.makedirs(common_path, exist_ok=True)

    file_count = 0

    for doc_type_id in COMMON_DOC_TYPES:
        if doc_type_id not in DOC_TYPES:
            continue
        content = generate_doc_content(doc_type_id)
        file_path = os.path.join(common_path, f"{doc_type_id}.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        file_count += 1

    def write_product_docs(carrier_id, product_id, samples_path):
        count = 0
        doc_dir = os.path.join(samples_path, carrier_id, product_id)
        os.makedirs(doc_dir, exist_ok=True)
        for doc_type_id in DOC_TYPES.keys():
            if doc_type_id in COMMON_DOC_TYPES:
                continue
            content = generate_doc_content(doc_type_id, carrier_id, product_id)
            fp = os.path.join(doc_dir, f"{doc_type_id}.md")
            with open(fp, "w", encoding="utf-8") as f:
                f.write(content)
            count += 1
        return count

    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        is_major = carrier.get("tier") == "major"

        products = SAMPLE_PRODUCTS["non-life"] if carrier_type == "non-life" else SAMPLE_PRODUCTS["life"]
        for product_id in products:
            file_count += write_product_docs(carrier_id, product_id, samples_path)

        if is_major:
            versioned = VERSIONED_PRODUCTS["non-life"] if carrier_type == "non-life" else VERSIONED_PRODUCTS["life"]
            for product_id in versioned:
                file_count += write_product_docs(carrier_id, product_id, samples_path)

    return file_count


def main():
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("=" * 60)
    print("KMS v3.0 샘플 데이터 생성기")
    print("=" * 60)

    print("\n[1/2] 그래프 데이터 생성 중...")
    graph_data = generate_graph_data()

    graph_path = os.path.join(base_path, "data", "knowledge-graph.json")
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)

    print(f"  ✓ {graph_path}")
    print(f"  - 노드: {graph_data['stats']['total_nodes']}개")
    print(f"  - 엣지: {graph_data['stats']['total_edges']}개")
    print(f"  - 문서: {graph_data['stats']['documents']}개")
    print(f"  - 규제: {graph_data['stats']['regulations']}개")

    # 라이프사이클 분포 출력
    doc_nodes = [n for n in graph_data['graph_data']['nodes'] if 'Document' in n.get('labels', [])]
    lifecycle_dist = {}
    for n in doc_nodes:
        lc = n['properties'].get('lifecycle', 'ACTIVE')
        lifecycle_dist[lc] = lifecycle_dist.get(lc, 0) + 1
    print(f"  - 라이프사이클 분포: {lifecycle_dist}")

    print("\n[2/2] 샘플 문서 파일 생성 중...")
    file_count = generate_sample_files(base_path)
    print(f"  ✓ data/samples/")
    print(f"  - 파일: {file_count}개")

    print("\n" + "=" * 60)
    print("✅ 샘플 데이터 생성 완료!")
    print("=" * 60)


if __name__ == "__main__":
    main()
