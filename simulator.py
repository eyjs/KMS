"""
KMS v2.1 샘플 데이터 생성기

taxonomy_v2_extended.py 기반 확장 샘플 생성:
- 법률/규정 문서
- 청약/계약 문서
- 정산/실적 문서
- 자격증/GA유형 정보
"""

import json
import os
from datetime import datetime, timedelta
from taxonomy import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DEFAULT_RELATIONS, DATA_TIERS, CERTIFICATIONS, GA_TYPES,
    REGULATION_TIMELINE, COMMISSION_TYPES, CHARGEBACK_RULES, KPI_METRICS
)

# 샘플 생성 대상
SAMPLE_CARRIERS = [
    "INS-SAMSUNG", "INS-HANWHA", "INS-KYOBO",  # 생명
    "INS-SAMSUNGF", "INS-HYUNDAI", "INS-DB", "INS-KB",  # 손해
]

SAMPLE_PRODUCTS = {
    "life": ["PRD-LIFE-WHOLE", "PRD-CHILD", "PRD-HEALTH-CANCER", "PRD-LIFE-VARIABLE", "PRD-HEALTH-CI"],
    "non-life": ["PRD-NONLIFE-AUTO", "PRD-HEALTH-MEDICAL"],
}

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


# 문서 내용 템플릿
DOC_TEMPLATES = {
    "DOC-LAW-INSURANCE": """# 보험업법 주요 조항

## 제87조 (모집할 수 있는 자)
보험설계사, 보험대리점, 보험중개사 등록 요건

## 제87조의3 (대형GA 공시의무)
500인 이상 GA 반기별 경영현황 공시

## 제95조의5 (독립대리점 비교·설명의무)
3개 이상 유사상품 비교설명 의무화

## 제97조 (모집질서유지)
부당 승환계약 금지

## 제98조 (특별이익 제공 금지)
금품 제공 한도: 1년 납입보험료의 10%와 3만원 중 적은 금액
""",

    "DOC-LAW-CONSUMER": """# 금융소비자보호법 6대 판매원칙

## 1. 적합성 원칙 (제17조)
고객 정보 파악 후 부적합 상품 권유 금지

## 2. 적정성 원칙 (제18조)
고객 자발적 가입 시에도 부적정 사실 고지

## 3. 설명의무 (제19조)
중요사항 설명, 왜곡·누락 금지

## 4. 불공정영업행위 금지 (제20조)
우월적 지위 이용 권익침해 금지

## 5. 부당권유행위 금지
부실고지 권유, 불확실 내용 단정 설명 금지

## 6. 광고규제
허위·과장광고 금지

## 위반 시 제재
- 계약취소: 3개월 이내
- 위법계약해지권: 5년 이내
""",

    "DOC-REGULATION": """# 감독규정 및 규제 일정

## 현행 규제
- 1200%룰: 초년도 모집수수료 월납 보험료의 12배 이내

## 규제 일정

| 시행일 | 내용 |
|--------|------|
| 2026-01 | 차익거래 금지기간 확대, 수수료율 비교공시 |
| 2026-07 | **1200%룰 GA 확대 적용** |
| 2027-01 | 4년 분급제 시행 |
| 2029-01 | 7년 분급제 전면 시행 |

## 대형GA 내부통제
- 500인 이상 GA 실태평가 시행 (2024~)
- 등급: 1등급(우수) ~ 5등급(취약)
""",

    "DOC-COMMISSION-CALC": """# 수수료 계산 기준

## 1200%룰
- 적용: 초년도 모집수수료 총액
- 한도: 월납 보험료의 12배 이내
- GA 확대: 2026년 7월부터

## 분급제 (2027년~)

### 선지급 수수료
- 계약체결비용 한도 내

### 유지관리수수료
- 7년간 분할 지급
- 장기 계약관리 유인 강화

## 환수(Chargeback) 기준
| 해지 시점 | 환수율 |
|----------|--------|
| 3개월 내 | 100% |
| 6개월 내 | 50% |
| 12개월 내 | 25~30% |

## 2027년 개편 후
- 4차년 이전 해지 시 환수 조치 적용
""",

    "DOC-CERTIFICATION": """# 설계사 자격증 교육

## 필수 자격
- 생명보험자격: 20시간 (공통 10 + 전문 10)
- 손해보험자격: 20시간

## 보수교육
- 주기: 2년마다
- 시간: 외부 8시간 이상
- 미이수 시: 자격 말소 (2023년 4.2만명 말소)

## 선택 자격
- **변액보험 판매자격**: 변액 상품 판매 필수
- **AFPK**: 재무설계사
- **CFP**: 국제공인재무설계사
- **손해사정사**

## 결격사유 (보험업법 제84조)
- 피성년후견인
- 파산 미복권자
- 보험업법 위반 벌금형 2년 미경과자
""",

    "DOC-APPLICATION": """# 청약서 작성 가이드

## 필수 기재사항
1. 계약자/피보험자 인적사항
2. 보험종류 및 보장내용
3. 보험료 및 납입방법
4. 보험기간

## 고지의무 (상법 제651조)
- 중요한 사항을 사실대로 고지
- 위반 시: 계약 해지 가능 (1개월/3년 이내)

## 자필서명
- 계약자 자필서명 필수
- 대리서명 금지

## 서류 교부
- 청약서 부본 전달
- 약관 전달
- 상품설명서 전달

## 청약철회 (금소법 제46조)
- 보험증권 수령 후 15일 이내
- 청약일로부터 30일 초과 시 불가
- 65세 이상 TM: 45일 이내
""",

    "DOC-SETTLEMENT": """# 수수료 정산 자료

## 정산 흐름
보험사 → GA → 설계사

## 수수료 종류
| 종류 | 설명 |
|------|------|
| FYC | 초년도수수료 (First Year Commission) |
| 유지수수료 | 차년도 이후 지급 |
| 시책 | 판매 촉진 인센티브 |
| 정착지원금 | 신규 설계사 지원 |
| 오버라이드 | 조직장 추가 수수료 |

## KPI 지표
| 지표 | 설명 | 평균 |
|------|------|------|
| 13회차 유지율 | 1년차 | 88.3% |
| 25회차 유지율 | 2년차 | 75.8% |
| 37회차 유지율 | 3년차 | 49.4% |
| 61회차 유지율 | 5년차 | 43.6% |

## 불완전판매비율
(품질보증해지 + 민원해지 + 무효) / 신계약 × 100
""",

    "DOC-CHARGEBACK": """# 수수료 환수 기준

## 환수(Chargeback) 제도
조기해약 시 수수료 회수

## 현행 환수율
| 해지 시점 | 환수율 |
|----------|--------|
| 3개월 내 | **100%** |
| 6개월 내 | **50%** |
| 12개월 내 | **25~30%** |

## 2027년 개편 후
- 4차년 이전 해지 시 환수 조치 적용
- 유지관리수수료 도입으로 환수 부담 분산

## 환수 제외 사유
- 피보험자 사망
- 보험사 귀책사유
- 천재지변

## 주의사항
- 환수 대상 계약 모니터링 필수
- 해지 방어 활동 중요
""",

    "DOC-ONBOARDING": """# 신입 설계사 온보딩 가이드

## 1주차: 기본 교육
- 회사 소개 및 조직 구조
- 보험 기초 이론
- 시스템 사용법 (청약, 조회)

## 2주차: 자격 취득
- 생명/손해보험 자격 교육 (20시간)
- 자격 시험 응시
- 등록 절차

## 3주차: 상품 교육
- 주력 상품 학습
- 청약 프로세스
- 컴플라이언스 기본

## 4주차: 실전 준비
- 판매 스크립트 연습
- 선배 동행 영업
- 첫 고객 상담

## 체크리스트
□ 보험자격증 취득
□ GA 등록 완료
□ 시스템 접근 권한
□ 명함 발급
□ 주력 상품 3개 이상 숙지
""",

    "DOC-COMPLIANCE-GUIDE": """# 컴플라이언스 가이드

## 완전판매 의무

### 설명의무
- 보험금 지급사유
- 면책사유
- 보장기간
- 해지환급금

### 적합성 확인
- 고객 재산상황
- 금융상품 경험
- 이해도
- 가입 목적

## 금지 행위

### 불완전판매 유형
1. 설명의무 위반
2. 자필서명 미이행
3. 서류 미교부
4. 부당승환계약
5. 부실고지 권유

### 제재
- 등록취소
- 업무정지 (최대 6개월)
- 과태료 (최대 1천만원)
- 형사처벌 (3년 이하 징역)

## 해피콜 대응
- 설명의무 이행 확인
- 정확한 답변
- 녹취 내용 확인
""",
}


def get_tier(doc_type: str) -> str:
    """문서유형의 티어 반환"""
    return DOC_TYPES.get(doc_type, {}).get("tier", "WARM")


def get_source(doc_type: str) -> str:
    """문서유형의 출처 반환"""
    return DOC_TYPES.get(doc_type, {}).get("source", "ga")


def generate_doc_id(doc_type: str, carrier: str = None, product: str = None, seq: int = 1) -> str:
    """문서 ID 생성"""
    if carrier and product:
        return f"{doc_type}-{carrier}-{product}-{seq:03d}"
    elif carrier:
        return f"{doc_type}-{carrier}-{seq:03d}"
    else:
        return f"{doc_type}-COMMON-{seq:03d}"


def generate_doc_content(doc_type: str, carrier: str = None, product: str = None) -> str:
    """문서 내용 생성"""
    try:
        from doc_templates import get_template
        carrier_name = CARRIERS.get(carrier, {}).get("name", "공통") if carrier else "공통"
        product_name = PRODUCTS.get(product, {}).get("name", "공통") if product else "공통"
        return get_template(doc_type, carrier_name, product_name)
    except Exception as e:
        # Fallback
        carrier_name = CARRIERS.get(carrier, {}).get("name", "공통") if carrier else "공통"
        product_name = PRODUCTS.get(product, {}).get("name", "공통") if product else "공통"
        doc_type_name = DOC_TYPES.get(doc_type, {}).get("name", doc_type)
        
        return f"""# {carrier_name} {product_name} {doc_type_name}

## 개요
{carrier_name}의 {product_name} 관련 {doc_type_name}입니다.

## 상세 내용
(내용 준비 중)

---
*문서 버전: 1.0*
*최종 수정: {datetime.now().strftime('%Y-%m-%d')}*
"""


def generate_graph_data():
    """그래프 데이터 생성"""
    nodes = []
    edges = []
    
    # 루트 노드
    nodes.append({
        "id": "ROOT-IFA-KNOWLEDGE",
        "labels": ["SystemRoot"],
        "properties": {
            "name": "iFA 지식체계 v2.1",
            "description": "보험 GA 지식 관리 시스템 (확장판)",
            "version": "2.1"
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
        
        nodes.append({
            "id": doc_id,
            "labels": ["Document", doc_type_id, tier, "COMMON"],
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
                "version": "1.0"
            }
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": doc_id, "type": "HAS_COMMON_DOC"})
    
    # 상품별 문서 생성
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
                "properties": {
                    "name": f"{carrier.get('name', '')} {product.get('name', '')}",
                    "carrier": carrier_id,
                    "product": product_id,
                    "category": product.get("category", "COMMON")
                }
            })
            edges.append({"source": carrier_id, "target": product_node_id, "type": "OFFERS"})
            
            # 문서 노드 (공통 문서 제외)
            for doc_type_id, doc_type in DOC_TYPES.items():
                if doc_type_id in COMMON_DOC_TYPES:
                    continue
                
                doc_id = generate_doc_id(doc_type_id, carrier_id, product_id)
                tier = doc_type.get("tier", "WARM")
                
                today = datetime.now()
                if tier == "HOT":
                    valid_from = today.strftime("%Y-%m-01")
                    valid_to = (today + timedelta(days=30)).strftime("%Y-%m-%d")
                else:
                    valid_from = (today - timedelta(days=90)).strftime("%Y-%m-%d")
                    valid_to = None
                
                nodes.append({
                    "id": doc_id,
                    "labels": ["Document", doc_type_id, tier],
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
                        "version": "1.0"
                    }
                })
                edges.append({"source": product_node_id, "target": doc_id, "type": "HAS_DOCUMENT"})
                doc_count += 1
                
                # 관계 추가
                relations = DEFAULT_RELATIONS.get(doc_type_id, {})
                for rel_type, targets in relations.items():
                    for target_doc_type in targets:
                        # 공통 문서는 공통 ID로 참조
                        if target_doc_type in COMMON_DOC_TYPES:
                            target_id = generate_doc_id(target_doc_type)
                        else:
                            target_id = generate_doc_id(target_doc_type, carrier_id, product_id)
                        edges.append({"source": doc_id, "target": target_id, "type": rel_type})
                        if rel_type == "SIBLINGS":
                            edges.append({"source": target_id, "target": doc_id, "type": rel_type})
    
    # 규제 일정 노드
    for reg in REGULATION_TIMELINE:
        reg_id = f"REG-{reg['date'].replace('-', '')}"
        nodes.append({
            "id": reg_id,
            "labels": ["Regulation", reg.get("status", "upcoming")],
            "properties": reg
        })
        edges.append({"source": "ROOT-IFA-KNOWLEDGE", "target": reg_id, "type": "HAS_REGULATION"})
    
    # 통계
    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "carriers": len(SAMPLE_CARRIERS),
        "common_docs": len(COMMON_DOC_TYPES),
        "doc_types": len(DOC_TYPES),
        "documents": doc_count + len(COMMON_DOC_TYPES),
        "regulations": len(REGULATION_TIMELINE),
        "version": "2.1",
        "generated_at": datetime.now().isoformat()
    }
    
    return {"stats": stats, "graph_data": {"nodes": nodes, "edges": edges}}


def generate_sample_files(base_path: str):
    """샘플 파일 생성"""
    samples_path = os.path.join(base_path, "data", "samples")
    
    # 공통 문서 디렉토리
    common_path = os.path.join(samples_path, "COMMON")
    os.makedirs(common_path, exist_ok=True)
    
    file_count = 0
    
    # 공통 문서 생성
    for doc_type_id in COMMON_DOC_TYPES:
        if doc_type_id not in DOC_TYPES:
            continue
        content = generate_doc_content(doc_type_id)
        file_path = os.path.join(common_path, f"{doc_type_id}.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        file_count += 1
    
    # 보험사/상품별 문서 생성
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        products = SAMPLE_PRODUCTS["non-life"] if carrier_type == "non-life" else SAMPLE_PRODUCTS["life"]
        
        for product_id in products:
            doc_dir = os.path.join(samples_path, carrier_id, product_id)
            os.makedirs(doc_dir, exist_ok=True)
            
            for doc_type_id in DOC_TYPES.keys():
                if doc_type_id in COMMON_DOC_TYPES:
                    continue
                content = generate_doc_content(doc_type_id, carrier_id, product_id)
                file_path = os.path.join(doc_dir, f"{doc_type_id}.md")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                file_count += 1
    
    return file_count


def main():
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    print("=" * 60)
    print("KMS v2.1 샘플 데이터 생성기")
    print("=" * 60)
    
    # 1. 그래프 데이터 생성
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
    
    # 2. 샘플 파일 생성
    print("\n[2/2] 샘플 문서 파일 생성 중...")
    file_count = generate_sample_files(base_path)
    print(f"  ✓ data/samples/")
    print(f"  - 파일: {file_count}개")
    
    print("\n" + "=" * 60)
    print("✅ 샘플 데이터 생성 완료!")
    print("=" * 60)


if __name__ == "__main__":
    main()
