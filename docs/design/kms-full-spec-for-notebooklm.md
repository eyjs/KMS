# KMS 지식관리체계 전체 스펙 (NotebookLM용 통합 문서)

> 이 문서는 KMS(Knowledge Management System) 프로젝트의 모든 설계를 하나의 파일에 통합한 것입니다.
> Google NotebookLM에 업로드하여 AI 기반 정리/질의에 활용하세요.
> 버전: 3.0 | 2026-02-07 | Phase 1 검증 완료

---

# PART 1: 프로젝트 개요

## 목표
GA(법인보험대리점)의 지식관리체계를 구축한다. 도메인 무관한 문서관리 프레임워크(시스템)와 도메인별 설정(가변)을 분리하여, GA 보험영업을 첫 번째 도메인으로 검증한 뒤 다른 사업(메디코드 등)에도 확장 가능한 구조를 만든다. 향후 RAG(Retrieval-Augmented Generation) 시스템의 기반 데이터를 준비한다.

## 단계별 계획

| 단계 | 목표 | 기술 | 상태 |
|------|------|------|------|
| Phase 1 | 분류체계 검증 (Admin 페이지) | JSON + localStorage + Vue CDN | 현재 (**검증 완료**) |
| Phase 2 | 전사 지식관리 시스템 | Vue 3 + PostgreSQL + REST API | 예정 |
| Phase 3 | AI RAG 시스템 연동 | Qdrant + 임베딩 파이프라인 | 예정 |

## 설계 철학: 창고지기 vs 요리사 모델

- **우리(KMS) = 창고지기**: 문서를 정확히 분류, 관계를 명확히 정의, 신선도를 자동 관리, SSOT를 강제 보장
- **외부(AI) = 요리사**: 창고에서 재료를 가져다 답변을 만듦. 분류와 관계가 잘 되어있으면 좋은 답변이 나옴

---

# PART 2: 시스템 프레임워크 (불변 규칙)

모든 도메인에 공통으로 적용되는 규칙이다. 이 규칙은 도메인이 바뀌어도 절대 변하지 않는다.

## 2.1 자동 채번

- 형식: `PG-XXXXXX` (6자리 제로패딩, 예: PG-000001)
- 위치 무관: 문서를 어디로 이동해도 ID가 바뀌지 않음
- 단조 증가: 시퀀스가 항상 증가, 재사용 없음
- 참조 안정성: 다른 문서가 PG-000123을 참조하면, 이동 후에도 참조가 깨지지 않음

## 2.2 라이프사이클 (6단계 상태 머신)

```
DRAFT → REVIEW → ACTIVE → STALE → DEPRECATED → ARCHIVED
          ↓                  ↑         ↓
       REJECTED          (갱신)    (복원 가능)
```

| 상태 | 의미 | 검색 노출 | 전이 가능 |
|------|------|----------|---------|
| DRAFT | 작성 중 | X | REVIEW |
| REVIEW | 검토 대기 | X | ACTIVE, DRAFT(반려) |
| ACTIVE | 유효 문서 | O | STALE(자동), DEPRECATED |
| STALE | 신선도 만료 | 경고 표시 | ACTIVE(갱신), DEPRECATED |
| DEPRECATED | 폐기 예정 | X | ARCHIVED, ACTIVE(복원) |
| ARCHIVED | 영구 보관 | X | - |

## 2.3 신선도 (Freshness)

경과일 = 현재일 - max(updatedAt, reviewedAt)

| 티어 | 대상 문서유형 | 변경빈도 | maxAge | 예시 |
|------|-------------|---------|--------|------|
| HOT | 시책, 수수료 | 수시 | 30일 | 매달 바뀌는 시책 |
| WARM | 상품설명서, 스크립트 | 분기 | 90일 | 분기별 갱신 |
| COLD | 약관, 교육자료 | 연간 | 365일 | 1년 주기 갱신 |

신선도 상태:
- FRESH: 경과일 < maxAge × 0.7 (녹색)
- WARNING: 경과일 < maxAge (노란색)
- EXPIRED: 경과일 >= maxAge → STALE 자동 전환 (빨간색)

## 2.4 SSOT (Single Source of Truth)

**규칙: 동일 도메인 + 동일 분류 경로에 ACTIVE 문서 최대 1건**

유효 예시:
- GA-SALES: KB손해 > 든든어린이 > 상품요약본 (ACTIVE) → OK
- GA-SALES: KB손해 > 든든어린이 > 판매스크립트 (ACTIVE) → OK (문서유형 다름)

SSOT 위반:
- GA-SALES: KB손해 > 든든어린이 > 상품요약본 (ACTIVE) — 이미 존재!
- → 신규 문서를 ACTIVE로 전환하면 기존 문서 자동 DEPRECATED

## 2.5 관계 유형 (5종)

| 관계 | 방향 | 크로스 도메인 | 이동 시 동작 |
|------|------|-------------|------------|
| PARENT_OF / CHILD_OF | 양방향 | 불가 | 자식 함께 이동 |
| SIBLING | 양방향 | 불가 | 도메인 변경 시 자동 해제 |
| REFERENCE | 단방향 | 가능 | ID 불변, 유지 |
| SUPERSEDES / SUPERSEDED_BY | 단방향 | 불가 | 유지 (버전 이력) |

## 2.6 버전

- Major.Minor 형식 (예: v1.0)
- 이동 시: minor 증가
- 상품 개편(SUPERSEDES) 시: major 증가

---

# PART 3: 도메인 설정 (가변)

시스템 프레임워크 안에서 각 도메인이 자유롭게 정의하는 설정이다.

## 3.1 GA 보험영업 도메인 (6개)

| 도메인 코드 | 이름 | 분류축 (facets) | SSOT 키 |
|------------|------|----------------|---------|
| GA-SALES | GA 영업/상담 | 보험사 × 상품 × 문서유형 | carrier + product + docType |
| GA-COMM | GA 수수료/정산 | 보험사 × 상품 × 문서유형 | carrier + product + docType |
| GA-CONTRACT | GA 계약관리 | 보험사 × 상품 × 문서유형 | carrier + product + docType |
| GA-COMP | GA 컴플라이언스 | 보험사 × 문서유형 | carrier + docType |
| GA-EDU | GA 교육/역량 | 문서유형 | docType |
| COMMON-COMP | 전사 규제/법률 | 문서유형 | docType |

핵심: GA-SALES는 3축(보험사×상품×문서유형), GA-COMP는 2축(상품 불필요), GA-EDU는 1축(문서유형만). 도메인마다 분류 깊이가 다르다.

## 3.2 3-Axis Taxonomy (GA)

### WHO: 보험사 (Carrier) — 17개
KB손해보험, 삼성생명, 한화생명, 교보생명, 메리츠화재, NH농협생명, 동양생명, ABL생명, 흥국생명, DB생명, 신한라이프, 현대해상, 롯데손해보험, DGB생명, KDB생명, 처브라이프, 공통(INS-COMMON)

### WHAT: 상품군 (Product) — 21개
종신보험, 정기보험, 변액종신, 어린이보험, 태아보험, CI보험, GI보험, 암보험, 건강보험, 연금보험, 변액연금, 저축보험, 변액저축, 치아보험, 운전자보험, 실손보험, 여행보험, 화재보험, 법인보험, 단체보험, 공통(PRD-COMMON)

### WHICH: 문서유형 (DocType) — 41개
약관, 특별약관, 상품설명서, 보험료표, 브로슈어, 상품요약본, 판매스크립트, 상품비교표, 가입설계서, 시책안내, 수수료표, 수수료계산서, 수수료알림, 정산자료, 환수기준표, 청약서, 고지사항, 심사가이드, 질병심사가이드, 교육자료, 신입교육자료, 자격시험자료, 역량평가, 감독규정, 컴플라이언스가이드, FAQ 등

## 3.3 문서유형 → 도메인 자동 매핑

| 문서유형 | 도메인 | 티어 |
|---------|--------|------|
| 시책안내, 수수료표, 수수료알림 | GA-SALES / GA-COMM | HOT |
| 상품설명서, 판매스크립트, 상품비교표 | GA-SALES | WARM |
| 약관, 교육자료 | GA-SALES / GA-EDU | COLD |
| 심사가이드, 질병심사가이드, 청약서, 고지사항 | GA-CONTRACT | WARM |
| 감독규정 | COMMON-COMP | COLD |
| 컴플라이언스가이드 | GA-COMP | COLD |
| 정산자료, 환수기준표 | GA-COMM | HOT |

## 3.4 도메인 확장 예시: 메디코드

```
"MEDI-SALES": {
  facets: [서비스(service), 단계(stage), 문서유형(docType)],
  ssotKey: ["service", "stage", "docType"]
}
"MEDI-TECH": {
  facets: [시스템(system), 문서유형(docType)],
  ssotKey: ["system", "docType"]
}
```

시스템 규칙(채번, 라이프사이클, SSOT, 신선도, 관계)은 동일하고, 분류축만 다르게 정의하면 새 도메인 추가 가능하다.

---

# PART 4: 데이터 모델

## 4.1 Page (문서) 엔티티

```
{
  id: "PG-000123",                      ← 자동 채번
  name: "KB손해보험 든든어린이보험 상품요약본",
  domain: "GA-SALES",                   ← 소속 도메인
  lifecycle: "ACTIVE",                  ← 라이프사이클 상태
  version: { major: 1, minor: 0 },
  tier: "WARM",                         ← 신선도 티어
  classification: {                     ← 도메인별 가변 분류
    carrier: "INS-KB",
    product: "PRD-CHILD",
    docType: "DOC-PRODUCT-SUMMARY"
  },
  meta: { process: "BIZ-CONSULT", audience: "AUD-AGENT" },
  relations: {
    parent: "STRUCT-INS-KB-PRD-CHILD",
    children: [],
    siblings: ["PG-000124", "PG-000125"],
    references: ["PG-000200"],
    supersedes: null,
    supersededBy: null
  },
  content: "",
  createdAt, updatedAt, reviewedAt
}
```

## 4.2 Domain 엔티티

```
"GA-SALES": {
  name: "GA 영업/상담",
  facets: [
    { id: "carrier", name: "보험사", required: true },
    { id: "product", name: "상품", required: true },
    { id: "docType", name: "문서유형", required: true }
  ],
  ssotKey: ["carrier", "product", "docType"]
}
```

## 4.3 Edge (관계) 모델

```
{ source: "PG-000123", target: "PG-000124", type: "SIBLING" }
{ source: "PG-000200", target: "PG-000123", type: "REFERENCE" }
```

양방향 관계는 양쪽 엣지를 모두 저장한다.

## 4.4 노션 페이지 모델

모든 것이 페이지(Page)이다. 카테고리도 페이지, 문서도 페이지, 구조 노드도 페이지이다.

```
ROOT-GA-SALES (페이지, 구조 노드)
├── KB손해보험 (페이지, 구조 노드, facet: carrier=INS-KB)
│   ├── 든든 어린이보험 (페이지, 구조 노드, facet: product=PRD-CHILD)
│   │   ├── PG-000001 상품요약본 (페이지, 문서)
│   │   ├── PG-000002 약관 v3 (페이지, 문서)
│   │   └── PG-000003 판매스크립트 (페이지, 문서)
│   └── 무배당 암보험 (페이지, 구조 노드, facet: product=PRD-CANCER)
│       └── PG-000005 상품설명서 (페이지, 문서)
```

자동 분류: 문서가 구조 노드 아래에 생성되면, 부모 체인을 올라가며 facet_value를 수집하여 classification을 자동으로 채운다.

---

# PART 5: 핵심 유즈케이스

## UC-01: 문서 업로드 (자동 분류)
1. 관리자가 파일 업로드 (예: "KB손해_든든어린이보험_상품요약본_202602.pdf")
2. 시스템이 파일명 파싱 → 보험사: KB손해보험(90%), 상품: 든든어린이보험(85%), 문서유형: 상품요약본(85%)
3. 도메인 자동 결정: GA-SALES
4. SSOT 중복 체크 자동 수행
5. 관리자 확인 후 "등록" → DRAFT 상태로 생성
6. "등록 + 다음 파일" → 생성 후 바로 다음 파일 선택기 열림
7. 스티키 컨텍스트: 같은 보험사 상품 연속 업로드 시 이전 선택값 자동 유지

## UC-02: 라이프사이클 관리
1. DRAFT → REVIEW (검토 요청) → ACTIVE (승인)
2. ACTIVE 전환 시 SSOT 자동 검증
3. 신선도 만료 시 ACTIVE → STALE 자동 전환
4. 관리자가 갱신 또는 DEPRECATED 처리

## UC-03: 문서 도메인 이동 (Git Conflict 방식)
1. 관리자가 문서의 도메인 변경 (예: GA-CONTRACT → GA-COMP)
2. 시스템이 영향 분석:
   - 자동 처리: product 필드 제거, 자식 함께 이동
   - 보존: 나가는 참조 (ID 불변), SUPERSEDES 체인
   - 컨플릭트: 형제, 들어오는 참조 → 관리자가 [유지] 또는 [해제] 선택
3. "이동 실행" → 도메인 변경 + 관계 해결

## UC-04: 상품 개편 (SUPERSEDES)
1. 리뉴얼 문서 업로드 ("든든어린이보험 리뉴얼(2026-02)")
2. 별도 상품으로 인식 (PRD-CHILD-R2602)
3. 기존 문서와 SUPERSEDES 관계 설정
4. 기존 문서 DEPRECATED → 리뉴얼만 ACTIVE

## UC-05: 참조 체인 전파 (시책 → 수수료 → 정산)
1. 시책 문서 조회
2. 참조 체인 자동 따라감: 시책(GA-SALES) → 수수료(GA-COMM) → 정산(GA-COMM)
3. 관련 문서 3단계까지 자동 수집
4. AI 에이전트는 이 체인을 컨텍스트로 사용하여 종합 답변 생성

## UC-06: AI 에이전트 범위 제한 검색
- 판매 에이전트: GA-SALES만 접근
- 계약 에이전트: GA-CONTRACT만 접근
- 통합 관리자: 전체 도메인 접근
- 에이전트 간 도메인 중복 0건

---

# PART 6: 검증 결과

## 스트레스 테스트 (stress_test.py)
- 총 노드: 9,810개
- 총 엣지: 19,893개
- 도메인: 5개
- 변경 이력: 9,832건
- 테스트: 79/79 통과
- 소요 시간: 21초

## E2E 테스트 (e2e_real_docs.py)
- 실제 GA 문서: 50건 (KB손해 10건, 삼성생명 10건, 한화생명 8건, 교보생명 7건, 메리츠 5건, 공통 5건, 상품개편 5건)
- 자동 분류 정확도: 100% (50/50)
- SSOT 충돌 감지: 정상
- 상품 개편 (SUPERSEDES): 정상
- 도메인 이동 + 관계 영향: 정상
- 참조 체인 전파: 시책→수수료→정산 확인
- 테스트: 28/28 통과

## 도메인별 문서 분포 (E2E 결과)
- GA-SALES: 47건 (57%)
- GA-COMM: 15건 (18%)
- GA-CONTRACT: 9건 (11%)
- GA-EDU: 6건 (7%)
- GA-COMP: 3건 (4%)
- COMMON-COMP: 2건 (3%)

---

# PART 7: Phase 2 이후 계획

## Phase 2: Vue 앱 전환
- Vue 3 + Vite + Pinia
- PostgreSQL + REST API
- SSOT: Partial Unique Index로 DB 레벨 보장
- 실시간 신선도 모니터링 대시보드
- 관리자 페이지 + 사용자(영업사원) 페이지 분리

## Phase 3: RAG 시스템 연동
- Qdrant 벡터 DB: 문서 임베딩 저장
- 검색: 도메인+lifecycle 필터 + 벡터 유사도
- 참조 체인: 앵커 문서 → 관련 문서 자동 수집 → 컨텍스트 구성
- AI 답변: 시책+수수료+정산을 한번에 종합 안내

---

# 부록: 주요 용어집

| 용어 | 설명 |
|------|------|
| GA | 법인보험대리점 (General Agency) |
| SSOT | Single Source of Truth — 동일 경로에 ACTIVE 1건 |
| Facet | 분류축 (보험사, 상품, 문서유형 등) |
| 구조 노드 | 분류값을 제공하는 페이지 (facet_type + facet_value) |
| 스티키 컨텍스트 | 연속 업로드 시 이전 선택값 자동 유지 |
| 참조 체인 | REFERENCE 관계를 따라 연결된 문서들의 경로 |
| SUPERSEDES | 상품 개편 시 신규→기존 대체 관계 |
| 티어 | 문서 변경빈도 등급 (HOT/WARM/COLD) |
