# Phase 2: 문서 체계 관리 시스템

> 발표용 스크립트 | NotebookLM PPT 생성용
> 상태: 현재 진행

---

# 슬라이드 1: 표지

**Phase 2: 문서 체계 관리 시스템**

*"검증된 체계를 실제 시스템으로"*

iFA 보험대리점 | 2026년 3~5월 (3개월)

---

# 슬라이드 2: Phase 2 목표

## 실제 사용 가능한 시스템 구축

### Phase 1 vs Phase 2

| 구분 | Phase 1 | Phase 2 |
|------|---------|---------|
| 목적 | 체계 검증 | 시스템 구축 |
| 데이터 | JSON 파일 | PostgreSQL DB |
| 서버 | 없음 (브라우저) | .NET Core API |
| UI | 단일 HTML | Vue 3 앱 |
| 사용자 | 개발자 | 실무 담당자 |

### Phase 2 핵심 질문

1. 문서를 업로드하고 저장할 수 있는가?
2. 분류와 관계를 관리할 수 있는가?
3. 문서를 화면에서 볼 수 있는가?
4. 외부 시스템에 API로 제공할 수 있는가?

---

# 슬라이드 3: 범위 정의

## 직접 구현 vs 외주 위임

### 직접 구현 (Phase 2)

| 기능 | 상세 |
|------|------|
| 파일 업로드 | PDF, Markdown, CSV |
| 분류 관리 | 보험사/상품/문서유형 선택 |
| 관계 관리 | 부모-자식, 참조, 대체 |
| 라이프사이클 | DRAFT → ACTIVE → DEPRECATED |
| 문서 뷰어 | PDF, Markdown, CSV 인라인 |
| 관계 그래프 | vis-network 시각화 |
| 외부 API | REST + API Key 인증 |

### 외주 위임 (Phase 2에서 제외)

| 기능 | 사유 |
|------|------|
| PDF 텍스트 추출 | Python 필요 |
| 한글 NLP | Python 필요 |
| 벡터 DB | 데이터 엔지니어링 |
| RAG 챗봇 | AI 전문 영역 |

---

# 슬라이드 4: 허용 파일 형식

## PDF, Markdown, CSV만

### 허용

| 형식 | 뷰어 | 이유 |
|------|------|------|
| PDF | pdf.js | 표준 문서 형식 |
| Markdown | marked.js | 텍스트 기반, 버전관리 용이 |
| CSV | 테이블 렌더링 | 데이터 표준 형식 |

### 차단

| 형식 | 이유 |
|------|------|
| Word (.docx) | 형식 복잡, 뷰어 불안정 |
| PowerPoint (.pptx) | 형식 복잡, 뷰어 불안정 |
| Excel (.xlsx) | CSV로 변환 권장 |
| HWP | 한컴 전용, 뷰어 없음 |

### 왜 제한하는가?

```
[문제]
모든 형식 지원 → 뷰어 개발 비용 증가 + 불안정

[해결]
3가지만 지원 → 안정적 뷰어 + 빠른 개발
나머지는 PDF로 변환 후 업로드 권장
```

---

# 슬라이드 5: 기술 스택

## IT팀이 운영 가능한 기술

### 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Vue 3 | 3.4+ | UI 프레임워크 |
| Element Plus | 2.x | UI 컴포넌트 |
| Vite | 5.x | 빌드 도구 |
| Pinia | 2.x | 상태 관리 |
| pdf.js | - | PDF 뷰어 |
| marked.js | - | Markdown 렌더링 |
| vis-network | 9.x | 관계 그래프 |

### 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| ASP.NET Core | 8.0 LTS | API 서버 |
| Entity Framework | 8.x | ORM |
| PostgreSQL | 16 | 데이터베이스 |
| JWT | - | 인증 |

### 왜 이 스택인가?

```
- Vue: 회사 표준 (필수)
- .NET: IT팀 운영 가능 (Python 불가)
- PostgreSQL: 무료 + JSONB 지원
```

---

# 슬라이드 6: 시스템 아키텍처

## 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                  Vue 3 + Element Plus                    │
│                   (Admin Dashboard)                       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (REST)
┌──────────────────────▼──────────────────────────────────┐
│                  ASP.NET Core 8 API                      │
│                                                          │
│  [Controllers]     [Services]        [Repositories]     │
│  - DocumentCtrl    - DocumentSvc     - EF Core          │
│  - RelationCtrl    - RelationSvc     - PostgreSQL       │
│  - TaxonomyCtrl    - TaxonomySvc                        │
└──────────────────────┬──────────────────────────────────┘
                       │ TCP
┌──────────────────────▼──────────────────────────────────┐
│                   PostgreSQL 16                          │
│                                                          │
│  [documents]  [classifications]  [relations]  [facets]  │
└──────────────────────┬──────────────────────────────────┘
                       │
                 [REST API /api/v1]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
    ┌─────────┐                 ┌─────────┐
    │ RAG 업체 │                 │ 미래 업체 │
    └─────────┘                 └─────────┘
```

---

# 슬라이드 7: 데이터베이스 설계

## 핵심 테이블

| 테이블 | 설명 |
|--------|------|
| users | 사용자 (JWT 인증) |
| domain_master | 도메인 정의 + 필수 facet |
| facet_master | 분류 마스터 + 신선도 설정 |
| documents | 문서 메타데이터 |
| classifications | 문서별 분류 (EAV) |
| relations | 문서 간 관계 |
| document_history | 변경 이력 |
| api_keys | 외부 API 인증 |

### ERD 요약

```
users ──────┐
            ├──► documents ◄──── domain_master
            │        │
            │        ├──► classifications ◄── facet_master
            │        │
            │        ├──► relations
            │        │
            └────────└──► document_history
```

---

# 슬라이드 8: 라이프사이클 구현

## DB 트리거로 자동화

### 상태 전환

```
DRAFT ──────────────► ACTIVE ──────────────► DEPRECATED
       (승인 시)              (새 버전 등록 시)
```

### 자동화 규칙

| 이벤트 | 자동 처리 |
|--------|----------|
| 문서 생성 | lifecycle = DRAFT |
| 승인 | lifecycle = ACTIVE, valid_from = NOW |
| 새 버전 ACTIVE | 기존 버전 DEPRECATED, valid_to = NOW |
| 수정 | updated_at, row_version 자동 갱신 |

### 트리거 목록

```sql
trg_check_ssot       -- SSOT 위반 방지
trg_check_cycle      -- 순환 참조 방지
trg_update_hash      -- 분류 해시 자동 생성
trg_doc_timestamp    -- 타임스탬프 자동 갱신
```

---

# 슬라이드 9: SSOT 구현

## 같은 경로에 ACTIVE 1개만

### 분류 해시

```sql
classification_hash = SHA256(
    domain + '|' +
    carrier + ':' + carrier_value + '|' +
    product + ':' + product_value + '|' +
    docType + ':' + docType_value
)
```

### 예시

```
문서: 삼성생명 > 종신보험 > 상품설명서

classification_hash = SHA256(
    "GA-SALES|carrier:INS-SAMSUNG|product:PRD-LIFE-WHOLE|docType:DOC-GUIDE"
)

결과: "a1b2c3d4e5f6..."
```

### SSOT 트리거

```sql
-- 새 문서를 ACTIVE로 만들 때
-- 같은 hash를 가진 기존 ACTIVE 문서가 있으면
-- 오류 발생 또는 기존 문서 DEPRECATED 처리
```

---

# 슬라이드 10: 시점 추적

## 최신이 정답이 아닐 때

### 문제 상황

```
[2021년 3월]
고객 A가 "든든 어린이보험" 계약 체결
당시 약관: v1.0

[2026년 2월]
약관은 이미 v5.0
고객 A: "내 계약 약관 보여주세요"

[잘못된 대응]
v5.0 제공 → "이거 내가 가입할 때랑 다른데요?"

[올바른 대응]
v1.0 제공 → "네, 이게 맞네요"
```

### 해결: 유효 기간 추적

```sql
documents (
    ...
    valid_from TIMESTAMP,  -- ACTIVE 시작일
    valid_to TIMESTAMP,    -- DEPRECATED 된 일
    ...
)
```

### 시점 조회

```sql
-- 2021년 3월 15일 시점 유효 문서
SELECT * FROM documents
WHERE valid_from <= '2021-03-15'
  AND (valid_to IS NULL OR valid_to > '2021-03-15')
```

---

# 슬라이드 11: API 설계

## 내부 API (Admin)

### 인증

```
POST /api/auth/login      JWT 발급
POST /api/auth/refresh    토큰 갱신
```

### 문서

```
POST   /api/documents              업로드
GET    /api/documents              목록
GET    /api/documents/{id}         상세
PUT    /api/documents/{id}         수정
DELETE /api/documents/{id}         삭제 (논리)
PATCH  /api/documents/{id}/lifecycle   상태 변경
PATCH  /api/documents/{id}/review      검토일 갱신
```

### 관계

```
GET    /api/documents/{id}/relations   관계 목록
POST   /api/relations                  관계 생성
DELETE /api/relations/{id}             관계 삭제
```

---

# 슬라이드 12: 외부 API

## 외주 업체용 API

### 인증

```
Header: X-API-Key: {api_key}
```

### 엔드포인트

```
GET /api/v1/documents              문서 목록 (필터, 페이징)
GET /api/v1/documents/{id}         메타데이터
GET /api/v1/documents/{id}/file    원본 다운로드
GET /api/v1/documents/{id}/relations   관계 조회
GET /api/v1/taxonomy/{type}        분류 목록
```

### 사용 예시

```bash
# 모든 ACTIVE 문서 조회
curl -H "X-API-Key: xxx" \
     "https://kms.company.com/api/v1/documents?lifecycle=ACTIVE"

# 특정 문서 다운로드
curl -H "X-API-Key: xxx" \
     "https://kms.company.com/api/v1/documents/123/file" \
     -o document.pdf
```

---

# 슬라이드 13: 파일 저장 구조

## 스토리지 설계

### 디렉토리 구조

```
/storage
├── originals/              # 원본 파일
│   └── {domain}/
│       └── {year}/
│           └── {uuid}.{ext}
│
├── thumbnails/             # PDF 썸네일 (선택)
│   └── {uuid}.png
│
└── temp/                   # 임시 업로드
    └── {upload_id}/
```

### 파일명 규칙

```
원본: {uuid}.{ext}
예시: 550e8400-e29b-41d4-a716-446655440000.pdf

장점:
- 중복 불가 (UUID)
- 경로 추측 불가 (보안)
- 원본 파일명은 DB에 저장
```

---

# 슬라이드 14: UI 설계

## Admin Dashboard

### 메인 화면

```
┌─────────────────────────────────────────────────────────┐
│  KMS 문서관리시스템                    [사용자] [로그아웃] │
├─────────────────────────────────────────────────────────┤
│  [문서] [분류관리] [관계] [API키] [대시보드]               │
├──────────────┬──────────────────────────┬───────────────┤
│              │                          │               │
│  필터        │     문서 목록             │   상세/미리보기│
│              │                          │               │
│  도메인      │  제목    상태   신선도    │   [PDF 뷰어]  │
│  보험사      │  ─────────────────────   │               │
│  상품        │  문서1   ACTIVE  ████    │   또는        │
│  문서유형    │  문서2   DRAFT   ░░░░    │               │
│  상태        │  문서3   ACTIVE  ██░░    │   [관계 그래프]│
│              │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

### 문서 뷰어

| 형식 | 뷰어 |
|------|------|
| PDF | pdf.js 임베드 |
| Markdown | marked.js 렌더링 |
| CSV | HTML 테이블 |

---

# 슬라이드 15: 보안

## 인증/인가

### 방식

| 구분 | 방식 | 대상 |
|------|------|------|
| Admin UI | JWT + Cookie | 내부 사용자 |
| 외부 API | API Key | 외주 업체 |

### 파일 보안

```
- 업로드 시 MIME 타입 검증
- 허용 확장자: .pdf, .md, .csv만
- 파일 크기 제한: 50MB
- 저장 경로 난독화 (UUID)
- 접근 로그 기록
```

### API Key 관리

```sql
api_keys (
    id,
    key_hash,        -- SHA256 해시 저장
    name,            -- "RAG업체A"
    permissions,     -- ["read"]
    expires_at,      -- 만료일
    is_active
)
```

---

# 슬라이드 16: 개발 일정

## 3개월 마일스톤

| 주차 | 마일스톤 |
|------|----------|
| W1-2 | 환경 구축, DB 스키마 |
| W3-4 | 문서 CRUD, 파일 업로드 |
| W5-6 | 관계 관리, 순환 방지 |
| W7-8 | Admin UI, 뷰어 |
| W9-10 | 외부 API, 인증 |
| W11-12 | 테스트, 안정화 |

### 주요 산출물

| 주차 | 산출물 |
|------|--------|
| W2 | DB 마이그레이션 완료 |
| W4 | 문서 업로드/다운로드 동작 |
| W6 | 관계 그래프 동작 |
| W8 | Admin UI 배포 |
| W10 | 외부 API 문서 |
| W12 | 운영 이관 완료 |

---

# 슬라이드 17: 완료 기준

## Phase 2 체크리스트

| 기준 | 측정 방법 |
|------|----------|
| 파일 업로드 | PDF/MD/CSV 업로드 성공 |
| 분류 CRUD | 보험사/상품/문서유형 관리 |
| 관계 CRUD | 관계 생성/삭제/조회 |
| 순환 방지 | 순환 참조 시 오류 발생 |
| SSOT | 중복 ACTIVE 시 경고 |
| PDF 뷰어 | 화면에서 PDF 확인 |
| MD 뷰어 | Markdown 렌더링 |
| CSV 뷰어 | 테이블 표시 |
| 관계 그래프 | vis-network 동작 |
| 외부 API | API Key 인증 동작 |
| IT팀 이관 | 운영 매뉴얼 전달 |

---

# 슬라이드 18: 외주 연동

## API 기반 연동

### 구조

```
┌─────────────────────────────────────┐
│           우리 시스템 (KMS)           │
│                                     │
│  문서 저장 + 분류 + 관계 + 뷰어       │
│  API 제공 (/api/v1/*)               │
└──────────────┬──────────────────────┘
               │
         [REST API]
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────┐          ┌─────────┐
│ RAG 업체 │          │ 미래 업체 │
└─────────┘          └─────────┘
```

### 업체 교체 시

```
1. 기존 업체 API Key 비활성화 (1분)
2. 새 업체 API Key 발급 (1분)
3. API 문서 전달 (1시간)
4. 연동 테스트 (1일)
5. 끝

데이터는 우리가 100% 소유
업체는 API로만 접근
```

---

# 슬라이드 19: 리스크 대응

## 예상 리스크

| 리스크 | 대응 |
|--------|------|
| 사용자 채택 실패 | 단계적 도입, 교육 지원 |
| 기술 문제 | 검증된 스택 (.NET 8 LTS) |
| 외주 의존 | API 표준화로 업체 교체 용이 |
| 데이터 손실 | 일일 백업, 이력 테이블 |
| 성능 문제 | 인덱스 최적화, 페이징 |

### 롤백 계획

```
문제 발생 시:
1. 새 기능 비활성화
2. 이전 버전 복원
3. 데이터 롤백 (이력 테이블 활용)
```

---

# 슬라이드 20: 결론

## Phase 2 요약

### 목표

```
Phase 1에서 검증된 체계를 실제 시스템으로 구현
```

### 범위

```
직접 구현:
├── 파일 업로드/저장
├── 분류/관계 관리
├── 문서 뷰어
└── 외부 API

외주 위임:
├── PDF 텍스트 추출
├── 한글 NLP
└── RAG 챗봇
```

### 기대 효과

```
- 중앙 집중 문서 관리
- 최신 문서 보장 (SSOT)
- 관련 문서 연결
- 외부 시스템 연동 가능
```

### 일정

```
2026년 3~5월 (3개월)
IT팀 운영 이관 포함
```

---

**문서 끝**
