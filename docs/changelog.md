# KMS 문서관리 프레임워크 변경 내역

---

## v3.0 (2026-02-08) - 프레임워크 전환

> 보험 특화 → 도메인 무관 프레임워크로 아키텍처 전환

### 핵심 변경

| 항목 | v2.0 | v3.0 |
|------|------|------|
| **아키텍처** | 보험 GA 전용 | 도메인 무관 프레임워크 |
| **구조** | 단일 분류체계 | 시스템(불변) + 도메인(가변) 분리 |
| **도메인** | 암시적 | 6개 명시적 도메인 (GA-SALES 등) |
| **SSOT** | 미정의 | 도메인별 유니크 키 강제 |
| **라이프사이클** | 4단계 | 6단계 상태 머신 |
| **신선도** | 수동 | 자동 계산 + 티어별 기준 |

### 시스템 프레임워크 (신규)

- 라이프사이클 상태 머신: DRAFT → REVIEW → ACTIVE → STALE → DEPRECATED → ARCHIVED
- 신선도 자동 계산: HOT(30일), WARM(90일), COLD(365일)
- 관계 타입 표준화: PARENT_OF, CHILD_OF, SIBLING, REFERENCE, SUPERSEDES
- SSOT 규칙: 도메인 + 분류 경로당 ACTIVE 문서 1개
- 버전 규칙: Major.Minor

### 도메인 정의 (신규)

```
GA-SALES     carrier x product x docType  영업 문서
GA-COMM      carrier x product x docType  수수료/정산
GA-CONTRACT  carrier x product x docType  계약관리
GA-COMP      carrier x docType            컴플라이언스
GA-EDU       docType                      교육
COMMON-COMP  docType                      전사 공통 규제
```

### 온톨로지 통합

- `src/ontology.py` 신규: 클래스 계층, 관계 메타데이터, 시소러스
- `src/simulator_ontology.py` 신규: @type 포함 그래프 생성
- `src/ontology_validator.py` 신규: 구조 검증 6/6

### Admin UI 개선

- `ui/admin-v3.html`: 계층 탐색 기반 다면 탐색 UI
- 시작 축 선택 (보험사/상품/문서유형)
- 관계 시각화 통합

### 문서 폴더 재구성

```
docs/
├── phase1/     Phase 1: 분류체계 검증 (현재)
├── phase2/     Phase 2: 백엔드 구축 (예정)
├── phase3/     Phase 3: RAG 시스템 (미래)
└── shared/     공유 문서
```

---

## v2.0 (2026-02-05) - 6-Facet 확장

> 3-Axis → 6-Facet 확장

### 변경 요약

| 항목 | v1.0 | v2.0 | 변화 |
|------|------|------|------|
| **Facet 수** | 3 | 6 | +3 (프로세스, 역할, 상태) |
| **보험사** | 3개 | 12개 | +9 (손해보험사 추가) |
| **상품군** | 2개 | 15개 | +13 (건강/손해/연금 추가) |
| **문서유형** | 6개 | 20개 | +14 |
| **업무프로세스** | - | 7개 | 신규 |
| **대상역할** | - | 6개 | 신규 |
| **관계유형** | 3개 | 8개 | +5 |

### Facet 1: 보험사 확장

```
[생명보험사 - 6개]
├── INS-SAMSUNG   삼성생명
├── INS-HANWHA    한화생명
├── INS-KYOBO     교보생명
├── INS-SHINHAN   신한라이프
├── INS-NH        NH농협생명
└── INS-DONGYANG  동양생명

[손해보험사 - 6개] ← 신규
├── INS-SAMSUNGF  삼성화재
├── INS-HYUNDAI   현대해상
├── INS-DB        DB손해보험
├── INS-KB        KB손해보험
├── INS-MERITZ    메리츠화재
└── INS-HANHWA-D  한화손해보험
```

### Facet 2: 상품군 확장

```
[생명보험 LIFE - 6개]
├── PRD-LIFE-WHOLE     종신보험
├── PRD-LIFE-TERM      정기보험
├── PRD-LIFE-VARIABLE  변액보험
├── PRD-LIFE-SAVING    저축보험
├── PRD-LIFE-EDU       교육보험
└── PRD-CHILD          어린이보험

[건강보험 HEALTH - 4개] ← 신규
├── PRD-HEALTH-CI      CI보험
├── PRD-HEALTH-CANCER  암보험
├── PRD-HEALTH-MEDICAL 실손의료보험
└── PRD-HEALTH-LTC     간병보험

[손해보험 NON-LIFE - 3개] ← 신규
├── PRD-NONLIFE-AUTO   자동차보험
├── PRD-NONLIFE-FIRE   화재보험
└── PRD-NONLIFE-LIAB   배상책임보험

[연금보험 ANNUITY - 2개] ← 신규
├── PRD-ANNUITY-TAX    세제적격연금
└── PRD-ANNUITY-GEN    일반연금
```

### Facet 3: 문서유형 확장 (6 → 20개)

```
[상품 관련 - 6개]
DOC-TERMS, DOC-TERMS-SPECIAL, DOC-GUIDE,
DOC-RATE-TABLE, DOC-COMPARISON, DOC-BROCHURE

[영업 관련 - 3개]
DOC-SCRIPT, DOC-INCENTIVE, DOC-COMMISSION

[심사 관련 - 3개] ← 신규
DOC-UW-GUIDE, DOC-UW-RULE, DOC-EXCLUSION

[교육/훈련 - 3개]
DOC-TRAINING, DOC-ONBOARDING, DOC-COMPLIANCE

[내부 운영 - 3개] ← 신규
DOC-SYSTEM-MANUAL, DOC-PROCESS, DOC-INTERNAL-MEMO

[전문가 지식 - 2개] ← 신규
DOC-BEST-PRACTICE, DOC-EXPERT-TIP
```

### Facet 4-5: 업무프로세스/역할 (신규)

```
[업무프로세스 - 7개]
BIZ-CONSULT, BIZ-UW, BIZ-ISSUE, BIZ-MAINTAIN,
BIZ-CLAIM, BIZ-SETTLE, BIZ-RECRUIT

[대상역할 - 6개]
AUD-AGENT, AUD-AGENT-NEW, AUD-AGENT-SENIOR,
AUD-MANAGER, AUD-UW, AUD-ADMIN
```

### 관계유형 확장

```
v1.0 (3개): siblings, references, supersedes

v2.0 (8개):
PARENT_OF ↔ CHILD_OF      계층 관계
SIBLINGS ↔ SIBLINGS       동일 레벨
REFERENCES → REFERENCED_BY 단방향 참조
SUPERSEDES → SUPERSEDED_BY 버전 대체
REQUIRES → REQUIRED_BY     선행 문서
```

---

## v1.0 (2026-02) - 초기 버전

> 3-Axis Taxonomy 기반 문서 분류체계

### 초기 구현

- 3개 분류축: 보험사(3개), 상품(2개), 문서유형(6개)
- 기본 관계: siblings, references, supersedes
- Admin HTML 페이지
- JSON 기반 데이터 저장
