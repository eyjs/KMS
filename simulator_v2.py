"""
KMS v2.0 샘플 데이터 생성기

확장된 taxonomy_v2.py 기반으로 샘플 데이터 생성:
- 손해보험사 추가
- 건강/손해/연금 상품 추가
- 새 문서유형 추가
- 6-Facet 메타데이터 포함
"""

import json
import os
from datetime import datetime, timedelta
from taxonomy_v2 import (
    CARRIERS, PRODUCTS, DOC_TYPES, PROCESSES, AUDIENCES,
    DEFAULT_RELATIONS, DATA_TIERS, VALIDITY_STATUS
)

# 샘플 생성 대상 (전체가 아닌 핵심 조합만)
SAMPLE_CARRIERS = [
    "INS-SAMSUNG", "INS-HANWHA", "INS-KYOBO",  # 생명 (기존)
    "INS-SAMSUNGF", "INS-HYUNDAI",              # 손해 (신규)
]

SAMPLE_PRODUCTS = {
    # 생명보험사용 상품
    "life": ["PRD-LIFE-WHOLE", "PRD-CHILD", "PRD-HEALTH-CANCER"],
    # 손해보험사용 상품
    "non-life": ["PRD-NONLIFE-AUTO", "PRD-HEALTH-MEDICAL"],
}

# 문서유형별 프로세스/역할 기본 매핑
DOC_PROCESS_MAP = {
    "DOC-TERMS": ["BIZ-CONSULT", "BIZ-COMMON"],
    "DOC-TERMS-SPECIAL": ["BIZ-CONSULT"],
    "DOC-GUIDE": ["BIZ-CONSULT"],
    "DOC-RATE-TABLE": ["BIZ-CONSULT", "BIZ-SETTLE"],
    "DOC-COMPARISON": ["BIZ-CONSULT"],
    "DOC-SCRIPT": ["BIZ-CONSULT"],
    "DOC-INCENTIVE": ["BIZ-SETTLE"],
    "DOC-COMMISSION": ["BIZ-SETTLE"],
    "DOC-UW-GUIDE": ["BIZ-UW"],
    "DOC-UW-RULE": ["BIZ-UW"],
    "DOC-EXCLUSION": ["BIZ-UW", "BIZ-CLAIM"],
    "DOC-TRAINING": ["BIZ-RECRUIT", "BIZ-COMMON"],
    "DOC-ONBOARDING": ["BIZ-RECRUIT"],
    "DOC-COMPLIANCE": ["BIZ-COMMON"],
    "DOC-BEST-PRACTICE": ["BIZ-CONSULT", "BIZ-UW"],
    "DOC-EXPERT-TIP": ["BIZ-CONSULT"],
}

DOC_AUDIENCE_MAP = {
    "DOC-TERMS": ["AUD-ALL"],
    "DOC-TERMS-SPECIAL": ["AUD-ALL"],
    "DOC-GUIDE": ["AUD-AGENT", "AUD-ALL"],
    "DOC-RATE-TABLE": ["AUD-AGENT"],
    "DOC-COMPARISON": ["AUD-AGENT"],
    "DOC-SCRIPT": ["AUD-AGENT", "AUD-AGENT-NEW"],
    "DOC-INCENTIVE": ["AUD-AGENT"],
    "DOC-COMMISSION": ["AUD-AGENT", "AUD-MANAGER"],
    "DOC-UW-GUIDE": ["AUD-UW", "AUD-AGENT-SENIOR"],
    "DOC-UW-RULE": ["AUD-UW"],
    "DOC-EXCLUSION": ["AUD-UW", "AUD-AGENT"],
    "DOC-TRAINING": ["AUD-AGENT", "AUD-AGENT-NEW"],
    "DOC-ONBOARDING": ["AUD-AGENT-NEW"],
    "DOC-COMPLIANCE": ["AUD-ALL"],
    "DOC-BEST-PRACTICE": ["AUD-AGENT-SENIOR", "AUD-MANAGER"],
    "DOC-EXPERT-TIP": ["AUD-AGENT"],
}


def get_tier(doc_type: str) -> str:
    """문서유형의 티어 반환"""
    return DOC_TYPES.get(doc_type, {}).get("tier", "WARM")


def generate_doc_id(doc_type: str, carrier: str, product: str, seq: int = 1) -> str:
    """문서 ID 생성"""
    return f"{doc_type}-{carrier}-{product}-{seq:03d}"


def generate_doc_content(doc_type: str, carrier: str, product: str) -> str:
    """문서 내용 템플릿 생성"""
    carrier_name = CARRIERS.get(carrier, {}).get("name", carrier)
    product_name = PRODUCTS.get(product, {}).get("name", product)
    
    templates = {
        "DOC-TERMS": f"""# {carrier_name} {product_name} 보통약관

## 제1조 (목적)
이 보험계약은 {carrier_name}과 보험계약자 간의 {product_name}에 관한 사항을 정함을 목적으로 합니다.

## 제2조 (용어의 정의)
- "계약자"란 회사와 계약을 체결하고 보험료를 납입하는 사람
- "피보험자"란 보험사고의 대상이 되는 사람
- "보험수익자"란 보험금 지급 청구권을 가지는 사람

## 제3조 (보험금 지급사유)
회사는 피보험자에게 다음의 사유가 발생한 경우 보험금을 지급합니다.
""",
        "DOC-GUIDE": f"""# {carrier_name} {product_name} 상품설명서

## 상품 개요
{carrier_name}의 대표 {product_name}입니다.

## 주요 보장 내용
- 주계약 보장
- 선택 특약

## 가입 조건
- 가입연령: 만 15세 ~ 70세
- 납입기간: 10년, 15년, 20년납
- 보험기간: 약정 기간

## 보험료 예시
상품설명서 참조
""",
        "DOC-SCRIPT": f"""# {carrier_name} {product_name} 판매 스크립트

## 오프닝
안녕하세요, {carrier_name} {product_name} 상담을 도와드릴 OOO입니다.

## 니즈 파악
1. 현재 보장 현황 파악
2. 고객 우려사항 확인
3. 가족 구성 파악

## 상품 소개 포인트
- 핵심 보장 강조
- 경쟁사 대비 장점
- 보험료 합리성

## 클로징
청약서 작성 안내
""",
        "DOC-INCENTIVE": f"""# {carrier_name} {product_name} 시책 안내

## 적용 기간
2026년 2월 1일 ~ 2026년 2월 28일

## 시책 내용
| 등급 | 달성 기준 | 추가 지급률 |
|------|----------|-----------|
| S등급 | 200% 이상 | +30% |
| A등급 | 150% 이상 | +20% |
| B등급 | 100% 이상 | +10% |

## 유의사항
- 본 시책은 해당 기간에만 적용됩니다.
- 조기 해지 시 환수 대상이 될 수 있습니다.
""",
        "DOC-COMMISSION": f"""# {carrier_name} {product_name} 수수료 체계

## 기본 수수료율
| 납입방식 | 1차년도 | 2차년도 이후 |
|---------|--------|-------------|
| 월납 | 45% | 3% |
| 연납 | 40% | 2.5% |

## 성과급 수수료
목표 달성률에 따른 추가 수수료

## 환수 규정
- 3개월 내 해지: 100% 환수
- 6개월 내 해지: 50% 환수
- 12개월 내 해지: 25% 환수
""",
        "DOC-RATE-TABLE": f"""# {carrier_name} {product_name} 보험료표

## 가입 조건
- 보험기간: 종신/만기
- 납입기간: 20년납
- 가입금액: 1억원 기준

## 월납 보험료 (단위: 원)
| 연령 | 남성 | 여성 |
|------|------|------|
| 30세 | 150,000 | 120,000 |
| 35세 | 180,000 | 145,000 |
| 40세 | 220,000 | 175,000 |
| 45세 | 280,000 | 220,000 |
| 50세 | 350,000 | 280,000 |

※ 실제 보험료는 가입 조건에 따라 달라질 수 있습니다.
""",
        "DOC-UW-GUIDE": f"""# {carrier_name} {product_name} 심사 가이드라인

## 기본 심사 원칙
1. 고지의무 확인
2. 과거 병력 검토
3. 현재 건강상태 평가

## 주요 심사 항목
- 질병 이력
- 직업 위험도
- 재무적 적정성

## 가입 제한 사항
- 청약일 기준 입원중인 경우
- 고위험 직업군
""",
        "DOC-UW-RULE": f"""# {carrier_name} 심사 기준

## 질병별 심사 기준

### 고혈압
| 혈압 수치 | 심사 결과 |
|----------|----------|
| 140/90 미만 | 표준체 |
| 140-160/90-100 | 부표준체 (할증 10%) |
| 160 이상 | 거절 또는 부담보 |

### 당뇨
| HbA1c | 심사 결과 |
|-------|----------|
| 6.5 미만 | 표준체 |
| 6.5-7.5 | 부표준체 |
| 7.5 이상 | 거절 |

## 직업별 심사 기준
- 1급(사무직): 표준
- 2급(경작업): 표준
- 3급(중작업): 할증 또는 제한
- 4급(위험직): 거절
""",
        "DOC-TRAINING": f"""# {carrier_name} {product_name} 교육 자료

## 학습 목표
1. 상품 구조 이해
2. 경쟁사 대비 차별점 파악
3. 효과적인 판매 전략 습득

## 교육 내용

### 1. 상품 개요
- 보장 내용
- 특약 구성
- 보험료 구조

### 2. 판매 포인트
- 고객 니즈별 접근법
- 이의 처리 방법

### 3. 실습
- 롤플레이
- 케이스 스터디

## 평가
- 필기 시험 70점 이상
- 롤플레이 통과
""",
        "DOC-ONBOARDING": f"""# 신입 설계사 온보딩 가이드

## 1주차: 기본 교육
- 회사 소개
- 보험 기초 이론
- 시스템 사용법

## 2주차: 상품 교육
- 주력 상품 학습
- 청약 프로세스
- 컴플라이언스

## 3주차: 실전 준비
- 판매 스크립트 연습
- 선배 동행 영업
- 첫 고객 상담

## 4주차: 독립 활동
- 자체 고객 발굴
- 피드백 및 코칭
""",
        "DOC-COMPLIANCE": f"""# 컴플라이언스 교육 자료

## 보험업법 핵심 조항
1. 설명의무 (제95조의2)
2. 적합성 원칙 (금소법 제17조)
3. 부당권유 금지 (제97조)

## 불완전판매 유형
- 설명의무 위반
- 자필서명 미이행
- 부당승환
- 허위고지 권유

## 제재 사례
- 등록취소
- 업무정지
- 과태료
- 형사처벌

## 체크리스트
□ 중요사항 설명 완료
□ 청약서 자필서명 확인
□ 청약서 부본 전달
□ 청약철회권 안내
""",
        "DOC-BEST-PRACTICE": f"""# 베스트 프랙티스: {product_name} 판매

## 작성자
홍길동 (10년차 시니어 설계사)

## 상황
{product_name} 판매 시 고객 거절 대응

## 권장 행동
1. 거절 이유 경청
2. 공감 표현
3. 대안 제시
4. 후속 연락 약속

## 실제 사례
"보험료가 부담된다"는 거절에 대해...

## 관련 문서
- {carrier_name} {product_name} 상품설명서
- 판매 스크립트
""",
        "DOC-EXPERT-TIP": f"""# 전문가 팁: {product_name}

## 작성자
김전문 (언더라이터 출신 설계사)

## 팁
{product_name} 가입 시 심사 통과율을 높이는 방법

### 핵심 포인트
1. 고지 사항 정확히 작성
2. 건강검진 결과 미리 확인
3. 부담보 조건 사전 협의

### 주의사항
- 부실고지 절대 금지
- 고객에게 정확한 정보 제공

## 신뢰도
상 (실무 경험 기반)
""",
        "DOC-EXCLUSION": f"""# {carrier_name} {product_name} 면책조항

## 보험금을 지급하지 않는 사유

### 공통 면책사항
1. 피보험자의 고의
2. 보험수익자의 고의
3. 계약자의 고의

### 질병 관련
- 계약 전 알릴의무 위반 질병
- 면책기간 내 발생 질병

### 재해 관련
- 피보험자의 범죄행위
- 피보험자의 정신장애 상태
- 전쟁, 외국의 무력행사

## 면책기간
- 암: 90일
- 일반질병: 없음
""",
        "DOC-COMPARISON": f"""# {product_name} 보험사별 비교표

## 비교 대상
- {carrier_name}
- 타사 A
- 타사 B

## 비교 항목

| 항목 | {carrier_name} | 타사 A | 타사 B |
|------|------------|-------|-------|
| 주계약 보장 | O | O | O |
| 특약 수 | 15개 | 12개 | 10개 |
| 갱신 주기 | 3년 | 5년 | 3년 |
| 30세 남성 보험료 | 15만원 | 16만원 | 14만원 |

## 강점 분석
- {carrier_name}: 특약 다양성
- 타사 A: 브랜드 인지도
- 타사 B: 가격 경쟁력

## 결론
고객 니즈에 따라 추천 상품 상이
""",
    }
    
    return templates.get(doc_type, f"# {carrier_name} {product_name} {DOC_TYPES.get(doc_type, {}).get('name', doc_type)}\n\n내용 준비 중...")


def generate_graph_data():
    """그래프 데이터 생성"""
    nodes = []
    edges = []
    
    # 루트 노드
    nodes.append({
        "id": "ROOT-IFA-KNOWLEDGE",
        "labels": ["SystemRoot"],
        "properties": {
            "name": "iFA 지식체계 v2.0",
            "description": "보험 GA 지식 관리 시스템 (6-Facet)",
            "version": "2.0"
        }
    })
    
    # 보험사 노드 (샘플 대상만)
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
        edges.append({
            "source": "ROOT-IFA-KNOWLEDGE",
            "target": carrier_id,
            "type": "HAS_CARRIER"
        })
    
    # 상품 노드 및 문서 노드
    doc_count = 0
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        
        # 보험사 유형에 맞는 상품 선택
        if carrier_type == "non-life":
            products = SAMPLE_PRODUCTS["non-life"]
        else:
            products = SAMPLE_PRODUCTS["life"]
        
        for product_id in products:
            product = PRODUCTS.get(product_id, {})
            product_node_id = f"{carrier_id}-{product_id}"
            
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
            edges.append({
                "source": carrier_id,
                "target": product_node_id,
                "type": "OFFERS"
            })
            
            # 문서유형별 문서 생성
            for doc_type_id, doc_type in DOC_TYPES.items():
                doc_id = generate_doc_id(doc_type_id, carrier_id, product_id)
                tier = doc_type.get("tier", "WARM")
                
                # 유효기간 설정
                today = datetime.now()
                if tier == "HOT":
                    valid_from = today.strftime("%Y-%m-01")
                    valid_to = (today + timedelta(days=30)).strftime("%Y-%m-%d")
                elif tier == "WARM":
                    valid_from = (today - timedelta(days=90)).strftime("%Y-%m-%d")
                    valid_to = None
                else:
                    valid_from = "2024-01-01"
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
                edges.append({
                    "source": product_node_id,
                    "target": doc_id,
                    "type": "HAS_DOCUMENT"
                })
                doc_count += 1
                
                # 문서 간 관계 추가
                relations = DEFAULT_RELATIONS.get(doc_type_id, {})
                for rel_type, target_doc_types in relations.items():
                    for target_doc_type in target_doc_types:
                        target_doc_id = generate_doc_id(target_doc_type, carrier_id, product_id)
                        edges.append({
                            "source": doc_id,
                            "target": target_doc_id,
                            "type": rel_type
                        })
                        # 양방향 관계는 역방향도 추가
                        if rel_type == "SIBLINGS":
                            edges.append({
                                "source": target_doc_id,
                                "target": doc_id,
                                "type": rel_type
                            })
    
    # 통계
    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "carriers": len(SAMPLE_CARRIERS),
        "products_per_carrier": len(SAMPLE_PRODUCTS["life"]),
        "doc_types": len(DOC_TYPES),
        "documents": doc_count,
        "version": "2.0",
        "generated_at": datetime.now().isoformat()
    }
    
    return {
        "stats": stats,
        "graph_data": {
            "nodes": nodes,
            "edges": edges
        }
    }


def generate_sample_files(base_path: str):
    """샘플 문서 파일 생성"""
    samples_path = os.path.join(base_path, "docs", "samples_v2")
    os.makedirs(samples_path, exist_ok=True)
    
    file_count = 0
    for carrier_id in SAMPLE_CARRIERS:
        carrier = CARRIERS.get(carrier_id, {})
        carrier_type = carrier.get("type", "life")
        
        if carrier_type == "non-life":
            products = SAMPLE_PRODUCTS["non-life"]
        else:
            products = SAMPLE_PRODUCTS["life"]
        
        for product_id in products:
            # 디렉토리 생성
            doc_dir = os.path.join(samples_path, carrier_id, product_id)
            os.makedirs(doc_dir, exist_ok=True)
            
            # 각 문서유형별 파일 생성
            for doc_type_id in DOC_TYPES.keys():
                content = generate_doc_content(doc_type_id, carrier_id, product_id)
                file_path = os.path.join(doc_dir, f"{doc_type_id}.md")
                
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                file_count += 1
    
    return file_count


def main():
    """메인 실행"""
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    print("=" * 60)
    print("KMS v2.0 샘플 데이터 생성기")
    print("=" * 60)
    
    # 1. 그래프 데이터 생성
    print("\n[1/3] 그래프 데이터 생성 중...")
    graph_data = generate_graph_data()
    
    graph_path = os.path.join(base_path, "knowledge_graph_v2.json")
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)
    
    print(f"  ✓ {graph_path}")
    print(f"  - 노드: {graph_data['stats']['total_nodes']}개")
    print(f"  - 엣지: {graph_data['stats']['total_edges']}개")
    print(f"  - 문서: {graph_data['stats']['documents']}개")
    
    # 2. 샘플 파일 생성
    print("\n[2/3] 샘플 문서 파일 생성 중...")
    file_count = generate_sample_files(base_path)
    print(f"  ✓ docs/samples_v2/ 디렉토리")
    print(f"  - 파일: {file_count}개")
    
    # 3. 검증
    print("\n[3/3] 데이터 검증 중...")
    
    # 노드 유형별 개수
    node_types = {}
    for node in graph_data["graph_data"]["nodes"]:
        for label in node["labels"]:
            node_types[label] = node_types.get(label, 0) + 1
    
    print("  노드 유형별 개수:")
    for label, count in sorted(node_types.items()):
        print(f"    - {label}: {count}")
    
    # 엣지 유형별 개수
    edge_types = {}
    for edge in graph_data["graph_data"]["edges"]:
        edge_type = edge["type"]
        edge_types[edge_type] = edge_types.get(edge_type, 0) + 1
    
    print("  관계 유형별 개수:")
    for edge_type, count in sorted(edge_types.items()):
        print(f"    - {edge_type}: {count}")
    
    # 티어별 문서 수
    tier_counts = {"HOT": 0, "WARM": 0, "COLD": 0}
    for node in graph_data["graph_data"]["nodes"]:
        if "Document" in node["labels"]:
            tier = node["properties"].get("tier", "WARM")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
    
    print("  티어별 문서 수:")
    for tier, count in tier_counts.items():
        print(f"    - {tier}: {count}")
    
    print("\n" + "=" * 60)
    print("✅ 샘플 데이터 생성 완료!")
    print("=" * 60)
    
    return graph_data


if __name__ == "__main__":
    main()
