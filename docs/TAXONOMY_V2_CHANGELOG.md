# KMS 분류체계 v2.0 변경 내역

> 2026-02-05 · 3-Axis → 6-Facet 확장

---

## 변경 요약

| 항목 | v1.0 | v2.0 | 변화 |
|------|------|------|------|
| **Facet 수** | 3 | 6 | +3 (프로세스, 역할, 상태) |
| **보험사** | 3개 | 12개 | +9 (손해보험사 추가) |
| **상품군** | 2개 | 15개 | +13 (건강/손해/연금 추가) |
| **문서유형** | 6개 | 20개 | +14 |
| **업무프로세스** | - | 7개 | 신규 |
| **대상역할** | - | 6개 | 신규 |
| **관계유형** | 3개 | 8개 | +5 |

---

## Facet 1: 보험사 (Carrier) 확장

### v1.0 (3개)
```
INS-SAMSUNG (삼성생명)
INS-HANWHA (한화생명)
INS-KYOBO (교보생명)
```

### v2.0 (12개)
```
[생명보험사 - 6개]
├── INS-SAMSUNG   삼성생명      (major)
├── INS-HANWHA    한화생명      (major)
├── INS-KYOBO     교보생명      (major)
├── INS-SHINHAN   신한라이프    (major) ← NEW
├── INS-NH        NH농협생명    (mid)   ← NEW
└── INS-DONGYANG  동양생명      (mid)   ← NEW

[손해보험사 - 6개] ← ALL NEW
├── INS-SAMSUNGF  삼성화재      (major)
├── INS-HYUNDAI   현대해상      (major)
├── INS-DB        DB손해보험    (major)
├── INS-KB        KB손해보험    (major)
├── INS-MERITZ    메리츠화재    (major)
└── INS-HANHWA-D  한화손해보험  (mid)

[공통]
└── INS-COMMON    공통 (보험사 무관)
```

---

## Facet 2: 상품군 (Product Line) 확장

### v1.0 (2개)
```
PRD-LIFE-WHOLE (종신보험)
PRD-CHILD (어린이보험)
```

### v2.0 (15개) - 2단계 계층 구조

```
[생명보험 LIFE - 6개]
├── PRD-LIFE-WHOLE     종신보험
├── PRD-LIFE-TERM      정기보험      ← NEW
├── PRD-LIFE-VARIABLE  변액보험      ← NEW
├── PRD-LIFE-SAVING    저축보험      ← NEW
├── PRD-LIFE-EDU       교육보험      ← NEW
└── PRD-CHILD          어린이보험

[건강보험 HEALTH - 4개] ← ALL NEW
├── PRD-HEALTH-CI      CI보험 (중대질병)
├── PRD-HEALTH-CANCER  암보험
├── PRD-HEALTH-MEDICAL 실손의료보험
└── PRD-HEALTH-LTC     간병보험

[손해보험 NON-LIFE - 3개] ← ALL NEW
├── PRD-NONLIFE-AUTO   자동차보험
├── PRD-NONLIFE-FIRE   화재보험
└── PRD-NONLIFE-LIAB   배상책임보험

[연금보험 ANNUITY - 2개] ← ALL NEW
├── PRD-ANNUITY-TAX    세제적격연금
└── PRD-ANNUITY-GEN    일반연금
```

---

## Facet 3: 문서유형 (Document Type) 확장

### v1.0 (6개)
```
DOC-TERMS      약관        (COLD)
DOC-GUIDE      상품설명서  (WARM)
DOC-SCRIPT     판매스크립트 (WARM)
DOC-INCENTIVE  시책        (HOT)
DOC-COMMISSION 수수료      (HOT)
DOC-TRAINING   교육자료    (COLD)
```

### v2.0 (20개)

```
[상품 관련 문서 - 6개]
├── DOC-TERMS          보통약관      (COLD)
├── DOC-TERMS-SPECIAL  특별약관      (COLD) ← NEW
├── DOC-GUIDE          상품설명서    (WARM)
├── DOC-RATE-TABLE     보험료표      (HOT)  ← NEW
├── DOC-COMPARISON     상품비교표    (WARM) ← NEW
└── DOC-BROCHURE       브로슈어      (WARM) ← NEW

[영업 관련 문서 - 3개]
├── DOC-SCRIPT         판매스크립트  (WARM)
├── DOC-INCENTIVE      시책          (HOT)
└── DOC-COMMISSION     수수료체계    (HOT)

[심사 관련 문서 - 3개] ← ALL NEW
├── DOC-UW-GUIDE       심사가이드라인 (WARM)
├── DOC-UW-RULE        심사기준      (COLD)
└── DOC-EXCLUSION      면책조항      (COLD)

[교육/훈련 문서 - 3개]
├── DOC-TRAINING       교육자료      (COLD)
├── DOC-ONBOARDING     신입교육      (COLD) ← NEW
└── DOC-COMPLIANCE     컴플라이언스  (COLD) ← NEW

[내부 운영 문서 - 3개] ← ALL NEW
├── DOC-SYSTEM-MANUAL  시스템매뉴얼  (COLD)
├── DOC-PROCESS        업무프로세스  (WARM)
└── DOC-INTERNAL-MEMO  내부공지      (HOT)

[전문가 지식 - 2개] ← ALL NEW
├── DOC-BEST-PRACTICE  베스트프랙티스 (WARM)
└── DOC-EXPERT-TIP     전문가팁      (WARM)
```

---

## Facet 4: 업무프로세스 (신규)

```
BIZ-CONSULT    상담/청약      고객 상담, 청약서 작성
BIZ-UW         심사           언더라이팅, 승낙/거절
BIZ-ISSUE      계약발행       보험증권 발행
BIZ-MAINTAIN   보전           계약 변경/해지/부활
BIZ-CLAIM      보험금청구     보험금 청구/심사/지급
BIZ-SETTLE     수수료정산     수수료 계산/정산/환수
BIZ-RECRUIT    리크루팅       설계사 채용/등록/위촉
BIZ-COMMON     공통           프로세스 무관
```

**활용 예시**:
- 시책 문서 → `BIZ-SETTLE` (수수료정산 프로세스)
- 심사가이드 → `BIZ-UW` (심사 프로세스)
- 판매스크립트 → `BIZ-CONSULT` (상담 프로세스)

---

## Facet 5: 대상역할 (신규)

```
AUD-AGENT        설계사        일반 설계사
AUD-AGENT-NEW    신입설계사    신입/수습 설계사
AUD-AGENT-SENIOR 시니어설계사  고성과 설계사
AUD-MANAGER      지점장/팀장   관리자급
AUD-UW           언더라이터    심사 담당자
AUD-ADMIN        본사관리자    본사 운영팀
AUD-ALL          전체          전체 대상
```

**활용 예시**:
- 신입교육 → `AUD-AGENT-NEW`
- 수수료체계 (골드등급 전용) → `AUD-AGENT-SENIOR`
- 심사기준 → `AUD-UW`

---

## Facet 6: 유효기간/상태

```
draft           임시저장     검색불가
reviewing       검토중       검색불가
approved        승인됨       검색불가 (활성화 대기)
active          활성         검색가능 ★ 기본값
pending_expiry  만료임박     검색가능 (7일 전)
expired         만료         검색불가
superseded      대체됨       검색가능 (경고 표시)
archived        보관         검색불가 (90일 후)
```

---

## 문서 관계유형 확장

### v1.0 (3개)
```
siblings    형제문서    양방향
references  참조        단방향
supersedes  대체 (신→구) 단방향
```

### v2.0 (8개)
```
PARENT_OF      상위문서   ↔ CHILD_OF        계층 관계
CHILD_OF       하위문서   ↔ PARENT_OF       계층 관계
SIBLINGS       형제문서   ↔ SIBLINGS        동일 레벨
REFERENCES     참조       → REFERENCED_BY   단방향 참조
REFERENCED_BY  참조됨     ← REFERENCES      역참조
SUPERSEDES     대체함     → SUPERSEDED_BY   버전 대체
SUPERSEDED_BY  대체됨     ← SUPERSEDES      버전 대체됨
REQUIRES       필요함     → REQUIRED_BY     선행 문서 필요
```

---

## 문서유형 간 기본 연결 규칙

```
상품설명서 (DOC-GUIDE)
├── REFERENCES → 보통약관, 특별약관
└── SIBLINGS → 판매스크립트, 브로슈어

판매스크립트 (DOC-SCRIPT)
├── REFERENCES → 상품설명서, 시책
└── SIBLINGS → 상품비교표

시책 (DOC-INCENTIVE)
└── REFERENCES → 수수료체계, 보험료표

심사가이드 (DOC-UW-GUIDE)
├── REFERENCES → 심사기준, 면책조항
└── PARENT_OF → 보통약관

특별약관 (DOC-TERMS-SPECIAL)
└── CHILD_OF → 보통약관

교육자료 (DOC-TRAINING)
└── REFERENCES → 약관, 상품설명서, 판매스크립트

베스트프랙티스 (DOC-BEST-PRACTICE)
└── REFERENCES → 상품설명서, 스크립트, 심사가이드
```

---

## Hot-Warm-Cold 티어 재분류

| 티어 | 갱신주기 | 캐시TTL | 우선순위 | 문서유형 |
|------|---------|---------|---------|----------|
| **HOT** | 매일 | 1시간 | 1 | 시책, 수수료, 보험료표, 내부공지 |
| **WARM** | 주간 | 1일 | 2 | 상품설명서, 스크립트, 심사가이드, 비교표, 브로슈어, 업무프로세스, BP, 팁 |
| **COLD** | 분기 | 7일 | 3 | 약관, 특약, 심사기준, 면책, 교육, 온보딩, 컴플라이언스, 시스템매뉴얼 |

---

## RAG 검색 시 활용 예시

### 질의: "삼성생명 종신보험 수수료율 알려줘"

**v1.0 동작**:
```
필터: insurer=INS-SAMSUNG, product=PRD-LIFE-WHOLE, doc_type=DOC-COMMISSION
결과: 수수료 문서 1개
```

**v2.0 동작**:
```
1차 필터: insurer=INS-SAMSUNG, product=PRD-LIFE-WHOLE, doc_type=DOC-COMMISSION
2차 관계 탐색: DOC-COMMISSION → REFERENCES → DOC-RATE-TABLE, DOC-INCENTIVE
3차 프로세스 연결: BIZ-SETTLE 관련 문서

결과:
├── 수수료체계 문서 (primary)
├── 현재 시책 문서 (관련, HOT)
└── 보험료표 (관련, HOT)
```

### 질의: "신입 설계사가 알아야 할 심사 기준"

**v2.0 동작**:
```
필터: audience=AUD-AGENT-NEW, process=BIZ-UW
관계 탐색: DOC-UW-GUIDE → DOC-UW-RULE, DOC-EXCLUSION
교차 필터: DOC-TRAINING (AUD-AGENT-NEW)

결과:
├── 심사가이드라인 (WARM)
├── 심사기준 요약 (COLD, 신입용)
├── 신입교육 - 심사 파트 (COLD)
└── 베스트프랙티스 - 심사 팁 (WARM, expert)
```

---

## 마이그레이션 계획

### Phase A-1: 기존 데이터 유지
- 기존 36개 문서 그대로 유지
- taxonomy_v2.py 추가 (기존 taxonomy.py 보존)

### Phase A-2: Admin 페이지 업데이트
- 새 Facet (프로세스, 역할) 입력 UI 추가
- 새 보험사/상품 선택 옵션 추가
- 관계유형 선택 확장

### Phase A-3: 샘플 데이터 확장
- 손해보험사 2개 추가 (삼성화재, 현대해상)
- 건강보험 상품 2개 추가 (암보험, 실손)
- 신규 문서유형 샘플 추가

---

## 파일 위치

```
/KMS/
├── taxonomy.py        # v1.0 (기존, 유지)
├── taxonomy_v2.py     # v2.0 (신규)
└── docs/
    └── TAXONOMY_V2_CHANGELOG.md  # 이 문서
```
