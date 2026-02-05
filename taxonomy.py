"""
iFA 지식체계 마스터 데이터 (Single Source of Truth)

3-Axis Taxonomy:
- WHO:   보험사 (Carrier)
- WHAT:  상품군 (Product)
- WHICH: 문서유형 (Document Type) + Tier
"""

# Facet 1: 보험사 (WHO)
CARRIERS = {
    "INS-SAMSUNG": {"name": "삼성생명", "alias": ["삼성", "SL"]},
    "INS-HANWHA": {"name": "한화생명", "alias": ["한화", "HL"]},
    "INS-KYOBO": {"name": "교보생명", "alias": ["교보", "KL"]},
}

# Facet 2: 상품군 (WHAT)
PRODUCTS = {
    "PRD-LIFE-WHOLE": {"name": "종신보험", "category": "생명"},
    "PRD-CHILD": {"name": "어린이보험", "category": "어린이/태아"},
}

# Facet 3: 문서유형 (WHICH) + Tier (Hot/Warm/Cold)
DOC_TYPES = {
    "DOC-TERMS": {"name": "약관", "tier": "COLD", "description": "법적 구속력 있는 보험계약 조건"},
    "DOC-GUIDE": {"name": "상품설명서", "tier": "WARM", "description": "고객용 상품 안내 자료"},
    "DOC-SCRIPT": {"name": "판매스크립트", "tier": "WARM", "description": "설계사 상담용 스크립트"},
    "DOC-INCENTIVE": {"name": "시책", "tier": "HOT", "description": "판매 촉진 인센티브 정책"},
    "DOC-COMMISSION": {"name": "수수료", "tier": "HOT", "description": "설계사 수수료 체계"},
    "DOC-TRAINING": {"name": "교육자료", "tier": "COLD", "description": "설계사 교육용 자료"},
}

# 문서 간 표준 연결 규칙 (2-Relation: PARENT_OF, RELATED_TO)
# key 문서는 value 문서들과 연결됨
RELATIONS = {
    "DOC-GUIDE": ["DOC-TERMS", "DOC-SCRIPT"],
    "DOC-SCRIPT": ["DOC-GUIDE", "DOC-INCENTIVE"],
    "DOC-INCENTIVE": ["DOC-COMMISSION"],
    "DOC-TRAINING": ["DOC-TERMS", "DOC-GUIDE"],
}

# 문서 템플릿 콘텐츠 (간략화)
DOC_TEMPLATES = {
    "DOC-TERMS": """
## 제1조 (목적)
이 보험계약(이하 "계약")은 보험계약자와 회사 간의 보험계약에 관한 사항을 정함을 목적으로 합니다.

## 제2조 (용어의 정의)
이 계약에서 사용하는 용어의 정의는 다음과 같습니다.
- "계약자"란 회사와 계약을 체결하고 보험료를 납입하는 사람을 말합니다.
- "피보험자"란 보험사고의 대상이 되는 사람을 말합니다.

## 제3조 (보험금 지급사유)
회사는 피보험자에게 다음 중 하나의 사유가 발생한 경우 보험금을 지급합니다.
""",
    "DOC-GUIDE": """
## 상품 개요
{carrier_name}의 대표 {product_name}입니다.

## 주요 보장 내용
- 사망보험금: 가입금액의 100%
- 재해사망보험금: 가입금액의 100% 추가

## 가입 조건
- 가입연령: 15세 ~ 70세
- 납입기간: 10년, 15년, 20년
- 보험기간: 종신
""",
    "DOC-SCRIPT": """
## 오프닝 멘트
안녕하세요, {carrier_name} {product_name} 상담을 도와드릴 OOO입니다.

## 니즈 파악 질문
1. 현재 가입하신 보험 상품이 있으신가요?
2. 가장 걱정되시는 위험은 어떤 것인가요?

## 상품 소개 포인트
- 합리적인 보험료로 종신 보장
- 해약환급금 활용 가능
""",
    "DOC-INCENTIVE": """
## 이달의 시책 안내

### 적용 기간
{effective_date} ~ {expiry_date}

### 시책 내용
| 등급 | 달성 기준 | 지급률 |
|------|----------|--------|
| S등급 | 200% 이상 | 기본 + 30% |
| A등급 | 150% 이상 | 기본 + 20% |
| B등급 | 100% 이상 | 기본 + 10% |

### 유의사항
- 본 시책은 해당 기간에만 적용됩니다.
""",
    "DOC-COMMISSION": """
## 수수료 체계

### 기본 수수료율
| 납입방식 | 1차년도 | 2차년도 이후 |
|---------|--------|-------------|
| 월납 | 45% | 3% |
| 연납 | 40% | 2.5% |

### 성과급 수수료
목표 달성률에 따라 추가 수수료가 지급됩니다.
""",
    "DOC-TRAINING": """
## 교육 목표
{carrier_name} {product_name}의 특징과 판매 전략을 이해합니다.

## 학습 내용
1. 상품 구조 이해
2. 경쟁사 비교 분석
3. 고객 니즈 파악 방법
4. 클로징 스킬

## 평가 기준
- 필기 시험 70점 이상
- 롤플레이 통과
""",
}
