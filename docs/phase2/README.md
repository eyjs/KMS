# Phase 2: 문서 체계 관리 시스템

> **Version** 3.2 | 2026-02-10 | 현재 단계

---

## 1. 목표

**문서 체계 관리 시스템을 구축한다.**

Phase 1에서 검증된 분류체계를 실제 시스템으로 구현:
- 문서 업로드/저장/분류/관계 관리
- 문서 뷰어 (PDF, Markdown, CSV)
- 외부 시스템용 API 제공
- 데이터 주권 확보

> **핵심 결정**: 문서 처리(파싱, NLP, 벡터화)는 외주에 위임하고, 체계 관리에 집중한다.

---

## 2. 범위

### 포함 (직접 구현)

| 기능 | 상세 |
|------|------|
| 파일 업로드 | PDF, Markdown, CSV만 허용 |
| 분류 관리 | 보험사/상품/문서유형 선택 |
| 관계 관리 | 부모-자식, 참조, 대체 관계 |
| 라이프사이클 | DRAFT → ACTIVE → DEPRECATED |
| SSOT 보장 | 중복 문서 경고 |
| 문서 뷰어 | PDF, Markdown, CSV 인라인 뷰어 |
| 관계 그래프 | vis-network 시각화 |
| 외부 API | REST API + API Key 인증 |

### 제외 (외주 위임)

| 기능 | 사유 |
|------|------|
| PDF 텍스트 추출 | Python 필요, 역량 부재 |
| 한글 NLP | Python 필요, 역량 부재 |
| 벡터 DB 구축 | 데이터 엔지니어링 영역 |
| RAG/챗봇 | Phase 3 또는 외주 |

---

## 3. 기술 스택

| 영역 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| 언어 | TypeScript (풀스택) | 5.7+ | 타입 안전성, 프론트·백 타입 공유 |
| Frontend | Vue 3 + Composition API | 3.5+ | 회사 표준 |
| UI | Element Plus | 2.x | Vue 3 호환 |
| 빌드 | Vite | 6.x | Vue 공식, HMR |
| Backend | NestJS | 10.x | TypeScript 네이티브, 모듈 구조 |
| ORM | Prisma | 6.x | 타입 안전 쿼리, 마이그레이션 |
| Database | PostgreSQL | 16 | 무료, JSONB, 트리거 |
| Monorepo | npm (workspaces 미사용) | - | Vercel 호환성 |
| PDF 뷰어 | pdf.js | - | 오픈소스 |
| MD 뷰어 | marked.js | - | 경량 |
| 그래프 | vis-network | 9.x | Phase 1 검증됨 |

---

## 4. 허용 파일 형식

| 형식 | 허용 | 뷰어 | 사유 |
|------|------|------|------|
| **PDF** | O | pdf.js | 표준 문서 형식 |
| **Markdown** | O | marked.js | 텍스트 기반, 버전관리 용이 |
| **CSV** | O | 테이블 렌더링 | 데이터 표준 형식 |
| Word | X | - | 형식 복잡, 뷰어 불안정 |
| PPT | X | - | 형식 복잡, 뷰어 불안정 |
| Excel | X | - | CSV로 변환 권장 |

---

## 5. 데이터베이스 설계

> **정본**: `database-schema.md` 참조

### 핵심 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 (JWT 인증용) |
| `domain_master` | 도메인 정의 + 필수 facet |
| `facet_master` | 분류 마스터 + 신선도 설정 |
| `documents` | 문서 메타데이터 |
| `classifications` | 문서별 분류 (EAV) |
| `relations` | 문서 간 관계 |
| `document_history` | 변경 이력 |
| `api_keys` | 외부 API 인증 |

### 주요 컬럼 추가 (기존 대비)

| 테이블 | 추가 컬럼 | 용도 |
|--------|----------|------|
| documents | `reviewed_at` | 신선도 계산 기준 |
| documents | `version_major/minor` | 버전 관리 |
| documents | `row_version` | 동시성 제어 |
| documents | `created_by/updated_by` | 감사 추적 |
| facet_master | `tier`, `max_age_days` | 신선도 설정 |
| relations | `id` (UUID) | 단일 키 삭제용 |

### 라이프사이클 (확정)

```
DRAFT → ACTIVE → DEPRECATED (3단계)
```

| 상태 | 설명 |
|------|------|
| DRAFT | 작성 중 |
| ACTIVE | 유효한 문서 |
| DEPRECATED | 만료됨 |

> REVIEW, STALE, ARCHIVED는 Phase 3에서 검토

---

## 6. API 설계

> **상세**: `reports/report-developer.md` 참조

### 내부 API (Admin)

```
인증
POST   /api/auth/login                 JWT 발급
POST   /api/auth/refresh               토큰 갱신

문서
POST   /api/documents                  업로드
GET    /api/documents                  목록 (?domain=&lifecycle=&page=&size=)
GET    /api/documents/{id}             상세
PUT    /api/documents/{id}             수정 (row_version 필수)
DELETE /api/documents/{id}             삭제 (논리)
PATCH  /api/documents/{id}/lifecycle   상태 변경
PATCH  /api/documents/{id}/review      검토일 갱신

파일/관계
GET    /api/documents/{id}/file        다운로드
GET    /api/documents/{id}/preview     미리보기
GET    /api/documents/{id}/relations   관계 목록 (?depth=1)
POST   /api/relations                  관계 생성
DELETE /api/relations/{id}             관계 삭제

분류
GET    /api/taxonomy/{facetType}       분류 목록
GET    /api/domains                    도메인 목록
```

### 외부 API (외주용)

```
GET /api/v1/documents                  목록 (필터, 페이징)
GET /api/v1/documents/{id}             메타데이터
GET /api/v1/documents/{id}/file        원본 다운로드
GET /api/v1/documents/{id}/relations   관계 조회
GET /api/v1/taxonomy/{type}            분류 목록

인증: X-API-Key 헤더
```

---

## 7. 파일 저장 구조

```
storage/
├── originals/              # 원본 파일
│   └── {domain}/
│       └── {year}/
│           └── {id}.{ext}
│
├── thumbnails/             # 미리보기 (선택)
│   └── {id}.png
│
└── extracted/              # Phase 3용 (비워둠)
```

---

## 8. 개발 일정

| 주차 | 마일스톤 |
|------|---------|
| W1-2 | 환경 구축, DB 스키마 |
| W3-4 | 문서 CRUD, 파일 업로드 |
| W5-6 | 관계 관리, 순환 방지 |
| W7-8 | Admin UI, 뷰어 |
| W9-10 | 외부 API, 인증 |
| W11-12 | 테스트, 안정화 |

**총 기간: 3개월**

---

## 9. 완료 기준

| 기준 | 상태 |
|------|------|
| 파일 업로드 (PDF/MD/CSV) | **완료** |
| 분류 CRUD + 코드 자동 생성 | **완료** |
| 관계 CRUD + 순환 방지 + DocumentExplorer | **완료** |
| 라이프사이클 상태 머신 | **완료** |
| SSOT 유니크 제약 | **완료** |
| PDF/MD/CSV 뷰어 | **완료** |
| 관계 그래프 시각화 (vis-network) | **완료** |
| 외부 API + 인증 (JWT + API Key) | **완료** |
| 대시보드 + 통합 검색 | **완료** |
| 사용자 관리 + 역할 기반 접근 제어 | **완료** |
| IT팀 운영 이관 | 예정 |

---

## 10. 외주 연동 구조

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

외주 교체 시:
1. API 키 발급
2. 매뉴얼 전달
3. 끝 (1일 소요)
```

---

## 11. 다음 단계

**Phase 3 (선택적 확장):**
- 조건: 예산 확보, 전문 인력 채용
- 내용: Python 코어 엔진, 벡터 DB, RAG 내재화

---

**문서 끝**
