# 보험 GA RAG 지식체계 — 아키텍처 & 문서관리 가이드

> **Version** 1.0 · 2025-02 · iFA IT팀

---

## 1. 전체 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────────┐
│                        사용자 인터페이스                              │
│   (챗봇 / 내부 포털 / 설계사 앱)                                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                     쿼리 오케스트레이터                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ 의도 분류기   │→│ 쿼리 라우터   │→│ Self-Query 메타데이터 필터 │ │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘ │
└────┬──────────────────┬──────────────────┬───────────────────────────┘
     │                  │                  │
┌────▼─────┐    ┌───────▼──────┐    ┌──────▼──────┐
│ 벡터 DB  │    │  SQL Engine  │    │  Graph DB   │
│ (Chroma/ │    │ (Text-to-SQL)│    │ (Neo4j/     │
│  Pinecone│    │              │    │  Neptune)   │
│  /Qdrant)│    │              │    │             │
└────┬─────┘    └───────┬──────┘    └──────┬──────┘
     │                  │                  │
     └──────────┬───────┘──────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│                     결과 융합 & 응답 생성                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────┐│
│  │ 결과 리랭킹   │→│ 충돌 해결기   │→│ LLM 응답 생성 + 출처 인용   ││
│  └──────────────┘  └──────────────┘  └─────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                 Data Virtualization 레이어                            │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  통합 스키마 │  │ 시맨틱 매핑 │  │  접근 제어   │  │  충돌 해결   │ │
│  └──────┬─────┘  └──────┬─────┘  └──────┬──────┘  └──────┬───────┘ │
└─────────┼───────────────┼───────────────┼────────────────┼──────────┘
          │               │               │                │
  ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
  │   Core DB    │ │   문서 저장소 │ │ 스프레드시트 │ │ Knowledge  │
  │ (SQL Server) │ │ (Blob/NAS)  │ │  (임포트)   │ │   Graph    │
  └──────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 2. Hot-Warm-Cold 벡터 인덱스 분리 전략

핵심 원칙: **변경 빈도가 다른 데이터를 같은 인덱스에 넣지 않는다.**

| 계층 | 벡터 Collection/Index | 재인덱싱 | 데이터 |
|:----:|:---------------------|:--------:|:------|
| **Hot** | `idx_hot_daily` | 매일 02:00 | 시책, 보험료표, 수수료 체계 |
| **Warm** | `idx_warm_weekly` | 매주 일요일 03:00 | 상품설명서, 심사기준, 가이드라인 |
| **Cold** | `idx_cold_archive` | 분기 1회 | 약관, 규정, 교육자료 |

**EmbeddingJob 테이블의 Priority 매핑:**

```
Hot  문서 → Priority 1 (즉시~당일)
Warm 문서 → Priority 3 (주간 배치)
Cold 문서 → Priority 7 (분기 배치)
수동 요청 → Priority 2 (우선 처리)
```

---

## 3. 문서 파일 관리 체계

### 3.1 물리적 디렉토리 구조

```
/knowledge-store/
├── /incoming/                          ← 수신 대기 (미처리)
│   ├── /email/                         ← 이메일 수신 자동 분류
│   ├── /portal/                        ← 보험사 포털 다운로드
│   └── /manual/                        ← 수동 업로드
│
├── /processing/                        ← 처리 중 (검증/추출 파이프라인)
│   ├── /ocr-queue/
│   ├── /validation/
│   └── /extraction/
│
├── /active/                            ← 현재 유효 문서 (서비스 중)
│   ├── /hot/
│   │   ├── /incentives/                ← 시책
│   │   │   └── /{InsurerCode}/
│   │   │       └── /{YYYY-MM}/
│   │   ├── /commissions/               ← 수수료
│   │   │   └── /{InsurerCode}/
│   │   └── /rate-tables/               ← 보험료표
│   │       └── /{InsurerCode}/
│   │           └── /{ProductCode}/
│   │
│   ├── /warm/
│   │   ├── /product-docs/              ← 상품설명서
│   │   │   └── /{InsurerCode}/
│   │   │       └── /{ProductCode}/
│   │   ├── /underwriting/              ← 심사기준
│   │   │   └── /{InsurerCode}/
│   │   └── /sales-materials/           ← 영업자료
│   │       └── /{InsurerCode}/
│   │
│   └── /cold/
│       ├── /terms/                     ← 약관
│       │   └── /{InsurerCode}/
│       │       └── /{ProductCode}/
│       ├── /regulations/               ← 규정
│       └── /training/                  ← 교육자료
│
├── /archive/                           ← 만료/대체 문서 (이력 보존)
│   └── /{YYYY}/
│       └── /{InsurerCode}/
│
└── /exports/                           ← 벡터 DB 익스포트 백업
    └── /{index-name}/
        └── /{YYYY-MM-DD}/
```

### 3.2 파일 명명 규칙

**패턴:**

```
{InsurerCode}_{DocTypeCode}_{ProductCode}_{YYYYMMDD}_v{Version}.{ext}
```

**예시:**

| 문서 | 파일명 |
|:-----|:------|
| 삼성생명 시책 2025년 2월 | `SAM_incentive_ALL_20250201_v1.0.pdf` |
| 한화생명 종신보험 상품설명서 | `HWA_product-desc_WLIFE001_20250115_v2.1.pdf` |
| 교보생명 정기보험 보험료표 | `KYB_rate-table_TLIFE003_20250201_v1.0.xlsx` |
| 삼성화재 자동차보험 보통약관 | `SAMF_general-terms_AUTO001_20240301_v1.0.pdf` |
| 내부 교육 신입 온보딩 | `IFA_product-training_ALL_20250101_v3.0.pptx` |

**규칙:**
- `InsurerCode`: 보험사 코드 (내부 코드 테이블 `Insurer.InsurerCode` 참조)
- `ProductCode`: 상품별이면 내부 코드, 전사 공통이면 `ALL`
- 날짜: 유효 시작일 (`ValidFrom`)
- 버전: Semantic Versioning (`Major.Minor`)
- 확장자: 원본 형식 유지

### 3.3 문서 수명주기 상태 전이

```
  ┌──────┐     승인      ┌────────────────────┐    effective_date
  │ draft │ ──────────→  │ pending_activation  │ ──────────────→
  └──────┘               └────────────────────┘

  ┌────────┐   만료 7일전    ┌─────────────────────┐   만료일     ┌─────────┐
  │ active │ ──────────→    │ pending_expiration   │ ────────→   │ expired │
  └────────┘                └─────────────────────┘              └────┬────┘
                                                                      │
       새 버전 등록 시                             90일 경과 시         │
  ┌────────────┐                              ┌──────────┐           │
  │ superseded │ ←── (이전 버전 자동 전환)      │ archived │ ←────────┘
  └────────────┘                              └──────────┘
```

---

## 4. 문서 수집/처리 파이프라인 (Ingestion Pipeline)

### 4.1 전체 흐름

```
Step 1: 감지 (Detection)
  │  이메일 파싱 / 포털 크롤링 / 수동 업로드
  │  → /incoming/ 디렉토리에 저장
  ▼
Step 2: 검증 (Validation)
  │  파일 무결성, 필수 메타데이터 확인
  │  중복 검사 (FileHash 비교)
  │  → /processing/validation/
  ▼
Step 3: 분류 & 메타데이터 추출 (Classification)
  │  문서 유형 자동 분류 (LLM 또는 규칙 기반)
  │  6-Facet 메타데이터 태깅
  │  → Document + DocumentVersion 레코드 생성
  ▼
Step 4: 컨텐츠 추출 & 청킹 (Extraction)
  │  PDF → OCR/텍스트 추출
  │  테이블 감지 & Markdown 변환
  │  문서 유형별 청킹 전략 적용 (DocumentType 설정 참조)
  │  → DocumentChunk 레코드 생성
  ▼
Step 5: 구조화 데이터 추출 (시책/수수료 전용)
  │  핵심 조건 JSON 구조화
  │  → IncentiveProgram / CommissionStructure 레코드
  ▼
Step 6: 임베딩 & 인덱싱
  │  DataTier에 따른 벡터 인덱스 선택
  │  EmbeddingJob 큐 등록 → 비동기 처리
  │  → 벡터 DB에 청크 + 메타데이터 저장
  ▼
Step 7: 활성화 & 알림
  │  effective_date 도래 시 status = 'active'
  │  관련 설계사에게 변경 사항 알림
  │  → /active/{tier}/ 디렉토리로 이동
  ▼
Step 8: 모니터링
  │  일일 만료 체크 (sp_ProcessExpirations)
  │  임베딩 품질 모니터링
  │  검색 정확도 피드백 수집
```

### 4.2 문서 유형별 청킹 구현 가이드

**원칙 1: 테이블은 절대 평탄화하지 않는다**

```
❌ 나쁜 예 (테이블을 텍스트로 평탄화):
"골드등급 초회보험료 대비 수수료율 35%, 실버등급 초회보험료 대비 수수료율 25%..."

✅ 좋은 예 (Markdown 테이블 구조 보존):
| 등급 | 초회 수수료율 | 유지 수수료율 | 조건 |
|------|-------------|-------------|------|
| 골드 | 35%         | 5%          | 월 5건 이상 |
| 실버 | 25%         | 3%          | 월 3건 이상 |
```

**원칙 2: 청크에 컨텍스트 앵커를 포함한다**

각 청크의 앞에 소속 문서/섹션 정보를 자동 삽입:

```
[삼성생명 > 종신보험(WLIFE001) > 수수료 체계 > 2025년 2월 적용]
| 등급 | 초회 수수료율 | ...
```

**원칙 3: 부모-자식 청킹에서 부모는 요약이다**

```
Parent Chunk:  "이 섹션은 삼성생명 종신보험의 심사 기준을 다루며,
               고혈압/당뇨/흡연 관련 조건을 포함합니다."
  ├─ Child 1:  고혈압 관련 심사 기준 상세
  ├─ Child 2:  당뇨 관련 심사 기준 상세
  └─ Child 3:  흡연 관련 심사 기준 상세
```

---

## 5. Knowledge Graph 스키마 (Neo4j Cypher)

### 5.1 노드 정의

```cypher
// ── 보험사 ──
CREATE CONSTRAINT FOR (i:Insurer) REQUIRE i.code IS UNIQUE;

// ── 상품 ──
CREATE CONSTRAINT FOR (p:Product) REQUIRE p.internalCode IS UNIQUE;

// ── 약관 ──
// ── 보험료 ──
// ── 수수료 ──
// ── 시책 ──
// ── 심사기준 ──
// ── 설계사 등급 ──
// ── 시간 기간 ──

// 노드 생성 예시
CREATE (sam:Insurer {
  code: 'SAM',
  name: '삼성생명',
  type: 'life',
  isPreferred: true
})

CREATE (wlife001:Product {
  internalCode: 'WLIFE001',
  name: '무배당 삼성 종신보험',
  category: 'life/whole_life',
  launchDate: date('2024-06-01'),
  isActive: true
})

CREATE (incentive_sam_202502:IncentiveProgram {
  programId: 'INC-SAM-202502-001',
  name: '2025년 2월 종신보험 판매 시책',
  type: 'commission_bonus',
  validFrom: date('2025-02-01'),
  validTo: date('2025-03-31'),
  status: 'active'
})
```

### 5.2 관계 정의

```cypher
// 보험사 → 상품
(sam)-[:OFFERS {since: date('2024-06-01')}]->(wlife001)

// 상품 → 약관
(wlife001)-[:HAS_TERMS {version: '2.0', effectiveDate: date('2024-06-01')}]->(terms_wlife001)

// 상품 → 보험료
(wlife001)-[:HAS_RATE {effectiveDate: date('2025-01-01')}]->(rate_wlife001)

// 상품 → 수수료 (등급별)
(wlife001)-[:HAS_COMMISSION {tier: 'gold', rate: 0.35}]->(comm_gold)
(wlife001)-[:HAS_COMMISSION {tier: 'silver', rate: 0.25}]->(comm_silver)

// 보험사 → 시책
(sam)-[:PROVIDES]->(incentive_sam_202502)
// 시책 → 대상 상품
(incentive_sam_202502)-[:TARGETS]->(wlife001)
// 시책 → 유효기간
(incentive_sam_202502)-[:VALID_DURING]->(period_202502)

// 상품 → 심사기준
(wlife001)-[:REQUIRES]->(uw_medical_01)

// 상품 간 관계 (대체/후속)
(wlife001)-[:SUPERSEDES]->(old_wlife001)
(wlife001)-[:SIMILAR_TO {similarity: 0.85}]->(hwa_wlife002)
```

### 5.3 GraphRAG 쿼리 패턴

**패턴 A: 다중 홉 탐색 (Local Search)**

```cypher
// "삼성생명 종신보험의 골드등급 수수료율과 현재 시책은?"
MATCH (ins:Insurer {code: 'SAM'})-[:OFFERS]->(p:Product)-[:HAS_COMMISSION]->(c)
WHERE p.category CONTAINS 'whole_life' AND c.tier = 'gold'
WITH ins, p, c
OPTIONAL MATCH (ins)-[:PROVIDES]->(inc:IncentiveProgram)-[:TARGETS]->(p)
WHERE inc.status = 'active'
  AND inc.validFrom <= date() AND (inc.validTo IS NULL OR inc.validTo >= date())
RETURN p.name, c.rate, inc.name, inc.validFrom, inc.validTo
```

**패턴 B: 비교 분석 (Global Search)**

```cypher
// "종신보험 수수료율이 가장 높은 보험사 Top 5"
MATCH (ins:Insurer)-[:OFFERS]->(p:Product)-[:HAS_COMMISSION]->(c)
WHERE p.category CONTAINS 'whole_life'
  AND c.tier = 'gold'
  AND c.status = 'active'
RETURN ins.name, p.name, c.rate
ORDER BY c.rate DESC
LIMIT 5
```

**패턴 C: 관계 경로 추론**

```cypher
// "이 상품과 비슷한 다른 보험사 상품 중 수수료 조건이 더 좋은 것은?"
MATCH (p:Product {internalCode: 'WLIFE001'})-[:SIMILAR_TO]->(similar:Product)
MATCH (similar)-[:HAS_COMMISSION]->(sc)
MATCH (p)-[:HAS_COMMISSION]->(pc)
WHERE sc.tier = pc.tier AND sc.rate > pc.rate
RETURN similar.name, sc.tier, sc.rate, pc.rate
```

---

## 6. Self-Query Retrieval 메타데이터 필터 매핑

사용자 자연어 질의에서 자동으로 메타데이터 필터를 추출하는 규칙:

| 자연어 패턴 | 추출 필터 |
|:-----------|:---------|
| "삼성생명" / "삼성" | `insurer_code = 'SAM'` |
| "종신보험" / "whole life" | `product_category CONTAINS 'whole_life'` |
| "골드등급" / "Gold" | `agent_tier = 'gold'` |
| "수수료" / "커미션" | `doc_type IN ('commission_structure')` |
| "시책" / "인센티브" | `doc_type = 'incentive_program'` |
| "약관" / "보통약관" | `doc_type IN ('general_terms', 'special_terms')` |
| "현재" / "지금" | `status = 'active'` |
| "지난달" / "1월" | `valid_from/valid_to` 날짜 범위 |
| "심사" / "언더라이팅" | `process = 'underwriting'` |
| "신입" / "교육" | `audience = 'newbie'` AND/OR `doc_type CONTAINS 'training'` |

**구현 흐름:**

```
사용자: "삼성생명 종신보험 골드등급 수수료율은?"

→ LLM 의도 분석:
  {
    "intent": "factual_lookup",
    "entities": {
      "insurer": "삼성생명",
      "product_category": "종신보험",
      "agent_tier": "골드",
      "info_type": "수수료율"
    }
  }

→ 메타데이터 필터 변환:
  {
    "insurer_code": "SAM",
    "product_category": "life/whole_life",
    "agent_tier_applicable": "gold",
    "doc_type": ["commission_structure", "incentive_program"],
    "status": "active"
  }

→ 병렬 실행:
  1. 벡터 검색: 의미적 유사도 + 위 필터
  2. SQL 조회:  CommissionStructure WHERE InsurerId AND ProductCategory AND TierId
  3. 그래프 탐색: (SAM)-[:OFFERS]->()-[:HAS_COMMISSION {tier:'gold'}]->()

→ 결과 융합 → LLM 응답 생성
```

---

## 7. 데이터 거버넌스 체크리스트

### 7.1 임베딩 전 품질 게이트

| # | 체크 항목 | 자동화 | 설명 |
|:-:|:---------|:------:|:----|
| 1 | 필수 메타데이터 완전성 | ✅ | 6개 Facet 중 최소 3개 태깅 필수 |
| 2 | 파일 무결성 (SHA-256) | ✅ | 중복/손상 파일 검출 |
| 3 | 유효기간 설정 | ✅ | Hot 티어는 반드시 ValidTo 필수 |
| 4 | 텍스트 추출 품질 | 🔄 | OCR 신뢰도 < 80%면 수동 검토 |
| 5 | 테이블 구조 보존 | 🔄 | Markdown 변환 후 셀 수 일치 확인 |
| 6 | 동의어/별칭 등록 | ❌ | 신규 보험사/상품 시 수동 등록 |
| 7 | 동료 리뷰 (암묵지) | ❌ | KnowledgeType = 'expert_*' 시 필수 |

### 7.2 정기 감사 주기

| 대상 | 주기 | 담당 | 내용 |
|:-----|:----:|:----:|:----|
| Hot 데이터 정합성 | 매주 | 시스템 | 만료 누락, 미활성화 시책 검출 |
| Warm 데이터 최신성 | 월간 | 담당자 | 가이드라인 변경 반영 확인 |
| Cold 데이터 유효성 | 분기 | 담당자 | 약관 개정 반영, 폐지 상품 아카이브 |
| 검색 품질 | 월간 | 시스템 | 검색 피드백 기반 정확도 모니터링 |
| 전체 인덱스 정합성 | 분기 | 시스템 | 벡터 DB ↔ SQL DB 동기화 검증 |

---

## 8. 충돌 해결 의사결정 트리

```
질의 결과에 복수 출처의 정보가 존재하는가?
│
├─ 아니오 → 단일 출처 결과 반환
│
└─ 예 → 출처 유형이 다른가?
    │
    ├─ DB vs 문서 충돌
    │   ├─ 금액/수치 → DB(계산 결과) 우선, 문서는 정의/근거로 보충
    │   └─ 규정/조건 → 문서(원본) 우선, DB는 코드화된 규칙으로 보충
    │
    ├─ 복수 문서 버전 충돌
    │   ├─ ValidTo가 있는 경우 → 현재 유효 버전 우선
    │   └─ 둘 다 active  → VersionNumber가 높은 것 우선
    │
    ├─ 보험사별 규정 vs 일반 규정
    │   └─ 해당 보험사 문서가 그 보험사에 대해 항상 우선
    │
    └─ 전문가 지식 vs 공식 문서
        └─ 공식 문서 우선, 불일치 플래그 + 리뷰 큐에 등록
```

---

## 9. API 엔드포인트 설계 (ASP.NET Core)

```
// ── 문서 관리 ──
GET    /api/documents                          전체 문서 목록 (필터/페이징)
GET    /api/documents/{id}                     문서 상세 (버전 이력 포함)
POST   /api/documents                          신규 문서 등록
PUT    /api/documents/{id}                     문서 메타데이터 수정
POST   /api/documents/{id}/versions            새 버전 업로드
PATCH  /api/documents/{id}/status              상태 변경

// ── 시책 관리 ──
GET    /api/incentives                         시책 목록 (유효 기간 필터)
GET    /api/incentives/active                  현재 유효 시책
POST   /api/incentives                         시책 등록
POST   /api/incentives/{id}/activate           시책 활성화

// ── 수수료 ──
GET    /api/commissions                        수수료 체계 조회
GET    /api/commissions/lookup                 ?insurer=SAM&product=WLIFE001&tier=gold

// ── RAG 검색 ──
POST   /api/search/query                       통합 검색 (쿼리 라우팅)
POST   /api/search/semantic                    벡터 검색
POST   /api/search/structured                  SQL 기반 검색
POST   /api/search/graph                       그래프 탐색

// ── 임베딩 관리 ──
GET    /api/embeddings/jobs                    임베딩 작업 현황
POST   /api/embeddings/jobs                    수동 재임베딩 요청
GET    /api/embeddings/stats                   인덱스별 통계

// ── 관리/거버넌스 ──
GET    /api/admin/expiring                     만료 예정 문서/시책
POST   /api/admin/run-expiration               만료 프로세스 수동 실행
GET    /api/admin/audit-log                    감사 로그 조회
GET    /api/admin/quality-report               데이터 품질 리포트
```

---

## 10. 우선순위별 구현 로드맵

### Phase 1: 기반 구축 (4주)

- [ ] DB 스키마 생성 및 기초 데이터 입력 (보험사, 상품 카테고리, 문서 유형)
- [ ] 파일 저장소 디렉토리 구조 설정
- [ ] 기본 CRUD API (문서, 보험사, 상품)
- [ ] 파일 업로드 + 메타데이터 태깅 UI

### Phase 2: 문서 파이프라인 (4주)

- [ ] PDF 텍스트/테이블 추출 (PyMuPDF + Camelot)
- [ ] 문서 유형별 청킹 엔진
- [ ] 벡터 DB 연동 (Chroma 또는 Qdrant)
- [ ] Hot/Warm/Cold 인덱스 분리
- [ ] 기본 시맨틱 검색 API

### Phase 3: 하이브리드 RAG (4주)

- [ ] 쿼리 의도 분류기 (LLM 기반)
- [ ] Self-Query 메타데이터 필터
- [ ] Text-to-SQL 통합 (수수료/계약 조회)
- [ ] 결과 융합 + LLM 응답 생성
- [ ] 만료 자동화 스케줄러

### Phase 4: GraphRAG + 고도화 (4주)

- [ ] Neo4j Knowledge Graph 구축
- [ ] 엔티티 추출 + 관계 자동 구축
- [ ] 그래프 탐색 통합
- [ ] 검색 품질 모니터링 대시보드
- [ ] 암묵지 캡처 워크플로우
