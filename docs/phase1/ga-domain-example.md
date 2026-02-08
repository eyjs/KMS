# GA 보험영업 도메인 - 구현 예시

> **목적**: 프레임워크의 첫 번째 적용 사례로서 GA 보험영업 도메인 구현

---

## 1. 도메인 개요

### 1.1 GA란?

**GA (General Agency)** = 법인보험대리점

- 여러 보험사의 상품을 판매하는 독립 대리점
- 설계사들이 다양한 보험사 상품을 비교 판매
- 문서 관리의 복잡도가 높음 (보험사 × 상품 × 문서유형)

### 1.2 GA 문서 관리의 문제

| 문제 | 현상 | 영향 |
|------|------|------|
| 시책 미반영 | 만료된 시책 정보 제공 | 수수료 오산정 |
| 보험사 혼동 | A사 기준을 B사에 적용 | 청약 반려 |
| 버전 혼재 | 구/신 정보 혼용 | 잘못된 의사결정 |
| 문서 산재 | 어디에 뭐가 있는지 모름 | 상담 지연 |

---

## 2. 도메인 정의

### 2.1 GA 도메인 구조

```python
GA_DOMAINS = {
    "GA-SALES": {
        "name": "GA 영업",
        "description": "보험사별 상품별 영업 관련 문서",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["carrier", "product", "docType"],
    },

    "GA-COMM": {
        "name": "GA 수수료/정산",
        "description": "수수료 및 정산 관련 문서",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["carrier", "product", "docType"],
    },

    "GA-COMP": {
        "name": "GA 컴플라이언스",
        "description": "규제 및 준수 관련 문서 (상품 무관)",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["carrier", "docType"],
    },

    "GA-EDU": {
        "name": "GA 교육",
        "description": "교육 및 훈련 자료 (보험사/상품 무관)",
        "facets": [
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["docType"],
    },

    "COMMON-COMP": {
        "name": "공통 규제",
        "description": "전사 공통 법규/규제 문서",
        "facets": [
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["docType"],
    },
}
```

### 2.2 마스터 데이터

#### 보험사 (Carrier)

```python
CARRIERS = {
    # 생명보험사
    "INS-SAMSUNG": {"name": "삼성생명", "type": "life", "tier": "major"},
    "INS-HANWHA": {"name": "한화생명", "type": "life", "tier": "major"},
    "INS-KYOBO": {"name": "교보생명", "type": "life", "tier": "major"},
    "INS-SHINHAN": {"name": "신한라이프", "type": "life", "tier": "major"},

    # 손해보험사
    "INS-SAMSUNGF": {"name": "삼성화재", "type": "non-life", "tier": "major"},
    "INS-HYUNDAI": {"name": "현대해상", "type": "non-life", "tier": "major"},
    "INS-DB": {"name": "DB손해보험", "type": "non-life", "tier": "major"},
    "INS-KB": {"name": "KB손해보험", "type": "non-life", "tier": "major"},
}
```

#### 상품 (Product)

```python
PRODUCTS = {
    # 생명보험
    "PRD-LIFE-WHOLE": {"name": "종신보험", "category": "life"},
    "PRD-LIFE-TERM": {"name": "정기보험", "category": "life"},
    "PRD-LIFE-VARIABLE": {"name": "변액보험", "category": "life"},

    # 건강보험
    "PRD-HEALTH-CI": {"name": "CI보험", "category": "health"},
    "PRD-HEALTH-CANCER": {"name": "암보험", "category": "health"},
    "PRD-HEALTH-MEDICAL": {"name": "실손의료보험", "category": "health"},

    # 손해보험
    "PRD-NONLIFE-AUTO": {"name": "자동차보험", "category": "non-life"},
    "PRD-NONLIFE-FIRE": {"name": "화재보험", "category": "non-life"},
}
```

#### 문서유형 (DocType)

```python
DOC_TYPES = {
    # 상품 관련 (COLD/WARM)
    "DOC-TERMS": {"name": "보통약관", "tier": "COLD", "maxAge": 365},
    "DOC-TERMS-SPECIAL": {"name": "특별약관", "tier": "COLD", "maxAge": 365},
    "DOC-GUIDE": {"name": "상품설명서", "tier": "WARM", "maxAge": 90},
    "DOC-RATE-TABLE": {"name": "보험료표", "tier": "HOT", "maxAge": 30},

    # 영업 관련 (HOT/WARM)
    "DOC-SCRIPT": {"name": "판매스크립트", "tier": "WARM", "maxAge": 90},
    "DOC-INCENTIVE": {"name": "시책", "tier": "HOT", "maxAge": 14},
    "DOC-COMMISSION": {"name": "수수료체계", "tier": "HOT", "maxAge": 30},

    # 심사 관련 (WARM/COLD)
    "DOC-UW-GUIDE": {"name": "심사가이드", "tier": "WARM", "maxAge": 90},
    "DOC-UW-RULE": {"name": "심사기준", "tier": "COLD", "maxAge": 180},

    # 교육 관련 (COLD)
    "DOC-TRAINING": {"name": "교육자료", "tier": "COLD", "maxAge": 365},
    "DOC-ONBOARDING": {"name": "신입교육", "tier": "COLD", "maxAge": 365},
}
```

---

## 3. 관계 규칙

### 3.1 기본 관계 (자동 추천)

```python
DEFAULT_RELATIONS = {
    # 약관은 특약의 부모
    "DOC-TERMS": {
        "children": ["DOC-TERMS-SPECIAL"],
    },

    # 상품설명서의 형제
    "DOC-GUIDE": {
        "siblings": ["DOC-SCRIPT", "DOC-RATE-TABLE"],
        "references": ["DOC-TERMS"],
    },

    # 시책과 수수료는 형제
    "DOC-INCENTIVE": {
        "siblings": ["DOC-COMMISSION", "DOC-RATE-TABLE"],
    },

    # 심사가이드는 심사기준 참조
    "DOC-UW-GUIDE": {
        "references": ["DOC-UW-RULE", "DOC-TERMS"],
    },

    # 교육자료는 다양한 문서 참조
    "DOC-TRAINING": {
        "references": ["DOC-TERMS", "DOC-GUIDE", "DOC-SCRIPT"],
    },
}
```

### 3.2 관계 시각화

```
                    ┌─────────────────┐
                    │   보통약관       │
                    │   (DOC-TERMS)   │
                    └────────┬────────┘
                             │ PARENT_OF
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ 특별약관   │  │ 특별약관   │  │ 특별약관   │
       │ (암)      │  │ (심장)    │  │ (뇌)      │
       └───────────┘  └───────────┘  └───────────┘


       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ 상품설명서 │◄─►│ 스크립트  │◄─►│ 보험료표  │
       │           │  │           │  │           │
       └─────┬─────┘  └───────────┘  └───────────┘
             │ REFERENCE
             ▼
       ┌───────────┐
       │  약관     │
       └───────────┘


       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │  시책     │◄─►│  수수료   │◄─►│ 보험료표  │
       │  (HOT)    │  │  (HOT)    │  │  (HOT)    │
       └───────────┘  └───────────┘  └───────────┘
              SIBLING 관계 (함께 변경되는 문서들)
```

---

## 4. 검증 결과

### 4.1 데이터 규모

| 항목 | 수량 |
|------|------|
| 도메인 | 6개 |
| 보험사 | 12개 |
| 상품 | 50+ |
| 문서유형 | 20개 |
| 생성된 문서 노드 | 767개 |
| 생성된 관계 엣지 | 2,439개 |

### 4.2 온톨로지 검증 (6/6)

| 검증 항목 | 상태 |
|----------|------|
| 클래스 계층 정합성 | Pass |
| 관계 타입 정의 완전성 | Pass |
| 필수 속성 존재 | Pass |
| 순환 참조 없음 | Pass |
| 고립 노드 없음 | Pass |
| SSOT 유니크 제약 | Pass |

### 4.3 시나리오 검증

| 시나리오 | 결과 |
|---------|------|
| 문서 등록 → 자동 분류 | Pass |
| SSOT 중복 → 자동 DEPRECATED | Pass |
| 문서 삭제 → 영향 분석 | Pass |
| 관계 연결 → 양방향 동기화 | Pass |
| 신선도 만료 → STALE 전환 | Pass |

---

## 5. 실행 명령

```bash
# 데이터 생성
python src/simulator.py

# 검증
python src/verifier.py
python src/ontology_validator.py

# Admin UI
npx serve . -p 8080
# http://localhost:8080/ui/admin-v3.html
```

---

## 6. 참고

- `project-overview.md` - 프로젝트 기획서 (큰그림)
- `framework-spec.md` - 아키텍처 설계서
- `domain-template.md` - 새 도메인 추가 템플릿
- `src/taxonomy.py` - GA 도메인 정의 코드
- `src/ontology.py` - 온톨로지 메타데이터
