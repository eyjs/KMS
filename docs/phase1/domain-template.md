# 도메인 정의 템플릿

> **목적**: 새로운 도메인을 프레임워크에 추가하기 위한 가이드

---

## 1. 도메인 정의서 템플릿

```python
DOMAIN = {
    # 1. 기본 정보
    "id": "MY-DOMAIN",
    "name": "도메인 한글명",
    "description": "이 도메인이 관리하는 문서의 범위",

    # 2. 분류 축 (facet) 정의
    "facets": [
        {
            "id": "axis1",
            "name": "축1 이름",
            "required": True,      # 필수 여부
            "description": "이 축이 의미하는 것"
        },
        {
            "id": "axis2",
            "name": "축2 이름",
            "required": True,
            "description": "이 축이 의미하는 것"
        },
        {
            "id": "docType",
            "name": "문서유형",
            "required": True,
            "description": "문서의 종류"
        },
    ],

    # 3. SSOT 키 (이 조합은 ACTIVE 문서 1개만)
    "ssotKey": ["axis1", "axis2", "docType"],

    # 4. 신선도 기준 (문서유형별)
    "freshnessRules": {
        "DOC-TYPE-A": {"tier": "HOT", "maxAgeDays": 30},
        "DOC-TYPE-B": {"tier": "WARM", "maxAgeDays": 90},
        "DOC-TYPE-C": {"tier": "COLD", "maxAgeDays": 365},
    },

    # 5. 기본 관계 규칙 (선택)
    "defaultRelations": {
        "DOC-TYPE-A": {
            "siblings": ["DOC-TYPE-B"],
            "references": ["DOC-TYPE-C"],
        },
    },
}
```

---

## 2. 마스터 데이터 정의

각 facet의 값 목록을 정의합니다.

```python
MASTER_DATA = {
    # 축1의 값 목록
    "axis1": [
        {"id": "VAL-001", "name": "값1", "aliases": ["별칭1", "별칭2"]},
        {"id": "VAL-002", "name": "값2", "aliases": []},
    ],

    # 축2의 값 목록
    "axis2": [
        {"id": "ITEM-001", "name": "항목1", "category": "분류"},
        {"id": "ITEM-002", "name": "항목2", "category": "분류"},
    ],

    # 문서유형 목록
    "docType": [
        {"id": "DOC-TYPE-A", "name": "문서유형A", "tier": "HOT"},
        {"id": "DOC-TYPE-B", "name": "문서유형B", "tier": "WARM"},
        {"id": "DOC-TYPE-C", "name": "문서유형C", "tier": "COLD"},
    ],
}
```

---

## 3. 체크리스트

### 3.1 도메인 설계 체크리스트

| 항목 | 질문 | 체크 |
|------|------|------|
| **범위** | 이 도메인이 관리할 문서의 범위가 명확한가? | ☐ |
| **facet** | 분류 축이 MECE(상호배제, 전체포괄)한가? | ☐ |
| **SSOT 키** | 유니크 제약이 비즈니스 요구사항에 맞는가? | ☐ |
| **신선도** | 문서유형별 갱신 주기가 적절한가? | ☐ |
| **마스터** | 마스터 데이터 목록이 완전한가? | ☐ |

### 3.2 관계 설계 체크리스트

| 항목 | 질문 | 체크 |
|------|------|------|
| **상하** | 부모-자식 관계가 있는 문서유형이 있는가? | ☐ |
| **좌우** | 함께 조회되어야 할 형제 문서가 있는가? | ☐ |
| **참조** | 다른 도메인 문서를 참조해야 하는가? | ☐ |
| **기본 관계** | 자동 추천할 관계 규칙이 필요한가? | ☐ |

### 3.3 구현 체크리스트

| 항목 | 작업 | 체크 |
|------|------|------|
| **정의** | `src/taxonomy.py`에 도메인 정의 추가 | ☐ |
| **마스터** | 마스터 데이터 목록 추가 | ☐ |
| **시뮬레이션** | `src/simulator.py`에 샘플 생성 로직 추가 | ☐ |
| **검증** | 테스트 시나리오 작성 및 실행 | ☐ |
| **UI** | Admin 페이지에 도메인 정보 반영 | ☐ |

---

## 4. 도메인 설계 예시

### 4.1 의료 코딩 도메인 (가상)

```python
MEDI_DOMAIN = {
    "id": "MEDI-CODING",
    "name": "의료 코딩",
    "description": "의료 청구 코딩 관련 문서 관리",

    "facets": [
        {"id": "hospital", "name": "병원", "required": True},
        {"id": "service", "name": "진료과", "required": True},
        {"id": "docType", "name": "문서유형", "required": True},
    ],

    "ssotKey": ["hospital", "service", "docType"],

    "freshnessRules": {
        "DOC-CODING-GUIDE": {"tier": "WARM", "maxAgeDays": 90},
        "DOC-CLAIM-RULE": {"tier": "HOT", "maxAgeDays": 30},
        "DOC-REGULATION": {"tier": "COLD", "maxAgeDays": 365},
    },
}
```

### 4.2 제조 품질 도메인 (가상)

```python
MFG_DOMAIN = {
    "id": "MFG-QC",
    "name": "제조 품질관리",
    "description": "제조 공정 및 품질 관련 문서 관리",

    "facets": [
        {"id": "supplier", "name": "협력사", "required": True},
        {"id": "part", "name": "부품", "required": True},
        {"id": "docType", "name": "문서유형", "required": True},
    ],

    "ssotKey": ["supplier", "part", "docType"],

    "freshnessRules": {
        "DOC-SPEC": {"tier": "COLD", "maxAgeDays": 365},
        "DOC-INSPECTION": {"tier": "WARM", "maxAgeDays": 90},
        "DOC-DEFECT-REPORT": {"tier": "HOT", "maxAgeDays": 7},
    },
}
```

---

## 5. 다음 단계

1. 도메인 정의서 작성
2. 마스터 데이터 수집
3. `src/taxonomy.py`에 추가
4. 샘플 데이터 생성 및 검증
5. Admin UI 테스트

---

## 6. 참고

- `project-overview.md` - 프로젝트 기획서 (큰그림)
- `framework-spec.md` - 아키텍처 설계서 (시스템 규칙)
- `ga-domain-example.md` - GA 도메인 구현 예시
