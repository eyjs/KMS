# KMS - 문서관리 프레임워크

> 문서의 분류, 관계, 라이프사이클을 체계적으로 관리하는 시스템

---

## 프로젝트 개요

문서 체계 관리에 집중하는 시스템이다. 문서 처리(파싱, NLP, 벡터화)는 외주에 위임하고, 원본 저장 + 분류 체계 + 관계 관리 + 라이프사이클 제어를 직접 구현한다.

### 프로젝트 단계

| 단계 | 목표 | 상태 | 기술 |
|------|------|------|------|
| **Phase 1** | 분류체계 검증 | **완료** | Python + JSON + HTML |
| **Phase 2** | 체계 관리 시스템 | **구현 완료** | NestJS + Vue 3 + TypeScript + PostgreSQL |
| **Phase 3** | 데이터 처리 확장 | 선택적 | Python 추가 (조건부) |

---

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 언어 | TypeScript (풀스택) | 5.7+ |
| Frontend | Vue 3 + Composition API | 3.5+ |
| UI | Element Plus | 2.x |
| 빌드 | Vite | 6.x |
| Backend | NestJS | 10.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| 그래프 | vis-network | 9.x |
| 뷰어 | pdf.js, marked.js, CSV 테이블 | - |
| 패키지 관리 | npm (workspaces 미사용) | - |

---

## 주요 기능

### 문서 관리
- 파일 업로드 (PDF, Markdown, CSV만 허용)
- 문서 상세 뷰어 (PDF, Markdown, CSV 인라인 미리보기)
- 라이프사이클 전환 (DRAFT → ACTIVE → DEPRECATED)
- 문서코드 자동 채번 (도메인-분류 기반)
- SSOT 보장 (동일 분류 경로에 ACTIVE 문서 1개만)
- 변경 이력 추적

### 분류 체계
- 도메인 CRUD (무제한 깊이 트리 구조) + 코드 자동 생성
- Facet CRUD (보험사/상품/문서유형 관리) + 코드 자동 생성
- 도메인 워크스페이스 (3패널: 분류 트리 | 문서 목록 | 미리보기)

### 관계 관리
- 관계 유형: 상위(PARENT_OF), 하위(CHILD_OF), 형제(SIBLING), 참조(REFERENCE), 대체(SUPERSEDES)
- DocumentExplorer: 형제문서/전체문서/검색 3탭으로 대상 문서 탐색
- 관계 그래프 시각화 (vis-network)
- 순환 참조 방지 (DB 트리거)

### 검색 및 탐색
- 통합 검색 (파일명, 문서코드, 분류 필터)
- 정렬 4종 (관련도, 최신, 이름, 코드)
- 검색 이력 자동완성 (localStorage)
- URL 상태 동기화 (검색어/필터/정렬 → query param)
- 키보드 단축키 (Ctrl+K → 검색)

### 대시보드
- 통계 카드 (전체/사용중/임시저장/조치필요) + 클릭 네비게이션
- 도메인별 문서 현황 테이블
- 조치 필요 문서 (경고/만료/파일없음/장기 임시저장) 탭
- 최근 활동 타임라인

### 인증 및 권한
- JWT 인증 (Access + Refresh Token)
- 외부 API Key 인증
- 업무 역할 기반 접근 제어 (직급 무관)
- 문서 보안 등급별 접근 제한

---

## 권한 체계

### 사용자 역할 (업무 역할 기반)

| 역할 | 한국어 | 접근 가능 문서 등급 |
|------|--------|-------------------|
| VIEWER | 조회자 | PUBLIC |
| EDITOR | 작성자 | PUBLIC, INTERNAL |
| REVIEWER | 검토자 | + CONFIDENTIAL |
| APPROVER | 승인자 | + SECRET |
| ADMIN | 관리자 | 전체 + 시스템 설정 |

### 문서 보안 등급

| 등급 | 설명 |
|------|------|
| PUBLIC | 공개 |
| INTERNAL | 사내용 |
| CONFIDENTIAL | 대외비(2급) |
| SECRET | 기밀(1급) |

---

## 화면 구성

| 경로 | 화면 | 설명 |
|------|------|------|
| `/` | 대시보드 | 통계 + 조치 필요 문서 + 최근 활동 |
| `/search` | 통합 검색 | 정렬, 필터, 검색이력, URL 동기화 |
| `/d/:code` | 도메인 워크스페이스 | 분류 트리 \| 문서 목록 \| 미리보기 |
| `/d/:code/doc/:id` | 문서 상세 | 뷰어 + 변경이력 + 관계 |
| `/d/:code/compare` | 문서 비교 | DocumentExplorer + 관계 그래프 |
| `/admin/domains` | 도메인/분류 관리 | 도메인 트리 + Facet CRUD |
| `/admin/users` | 사용자 관리 | 역할 변경, 활성화/비활성화 |
| `/login` | 로그인 | JWT 인증 |

---

## 데이터베이스

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 (JWT 인증) |
| `domain_master` | 도메인 정의 (트리 구조) + 필수 facet |
| `facet_master` | 분류 마스터 (보험사/상품/문서유형) + 신선도 설정 |
| `documents` | 문서 메타데이터 + 파일 경로 + 보안등급 + 버전 |
| `classifications` | 문서별 분류 (EAV 패턴) |
| `relations` | 문서 간 관계 (순환 방지 트리거) |
| `document_history` | 변경 이력 (액션 + JSON diff) |
| `api_keys` | 외부 API 인증 키 |

주요 제약조건:
- **순환 참조 방지**: PARENT_OF/CHILD_OF 트리거
- **SSOT**: 동일 분류 해시 + ACTIVE = 1개 트리거
- **낙관적 잠금**: row_version 자동 증가

---

## 디렉토리 구조

```
/
├── CLAUDE.md                        # 프로젝트 규칙
├── README.md                        # 이 파일
├── vercel.json                      # Vercel 배포 설정
├── docker-compose.yml               # PostgreSQL + pgAdmin
│
├── packages/
│   ├── shared/                      # @kms/shared (타입 + 상수)
│   │   └── src/
│   │       ├── types.ts             # Enum, 엔티티, DTO 인터페이스
│   │       ├── constants.ts         # 전환 규칙, 권한 매핑, 라벨
│   │       └── index.ts
│   │
│   ├── api/                         # @kms/api (NestJS 백엔드)
│   │   ├── src/
│   │   │   ├── prisma/              # PrismaService (Global)
│   │   │   ├── auth/                # JWT + API Key + 역할 가드 + 보안등급 가드
│   │   │   ├── documents/           # 문서 CRUD + 업로드 + 통계 + 검색 + 이슈
│   │   │   ├── relations/           # 관계 CRUD (순환 방지, scope 검증)
│   │   │   ├── taxonomy/            # 도메인 + Facet 마스터 데이터 API
│   │   │   └── common/              # 필터, 인터셉터
│   │   └── prisma/
│   │       ├── schema.prisma        # DB 스키마
│   │       ├── triggers.sql         # SSOT + 순환방지 트리거
│   │       └── seed.ts              # 초기 데이터 (도메인, Facet, admin 계정)
│   │
│   └── web/                         # @kms/web (Vue 3 프론트엔드)
│       └── src/
│           ├── router/              # 라우터 + 인증 가드 + 역할 가드
│           ├── stores/              # Pinia (auth, domain)
│           ├── api/                 # Axios 클라이언트 (토큰 갱신, 전역 에러 처리)
│           ├── views/               # 8개 페이지 컴포넌트
│           ├── components/
│           │   ├── common/          # StatusTag (라이프사이클/보안/신선도)
│           │   ├── document/        # DocumentExplorer, DocumentPreview, DocumentTable, DocumentTimeline
│           │   ├── domain/          # ClassificationTree, UploadDialog, DomainMenuItem
│           │   ├── graph/           # RelationGraph (vis-network)
│           │   ├── layout/          # AppLayout (사이드바 + 라우터뷰)
│           │   └── viewer/          # PdfViewer, MarkdownViewer, CsvViewer
│           └── composables/         # useKeyboardShortcuts, useSearchHistory, useRecentDocs
│
├── scripts/                         # Phase 1 Python 검증 도구
├── legacy/                          # Phase 1 아카이브
└── docs/                            # 설계 문서
```

---

## 개발 환경 설정

### 사전 요구사항
- Node.js 20+
- PostgreSQL 16 (또는 Docker)

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install
npm --prefix packages/shared install
npm --prefix packages/api install
npm --prefix packages/web install

# 2. shared 빌드 (반드시 먼저)
npm --prefix packages/shared run build

# 3. DB 시작
docker compose up -d postgres

# 4. Prisma 마이그레이션 + 시드
npm --prefix packages/api exec prisma migrate dev
npm --prefix packages/api exec prisma db seed

# 5. 트리거 적용 (SSOT, 순환방지)
# psql $DATABASE_URL -f packages/api/prisma/triggers.sql

# 6. 개발 서버
npm --prefix packages/api run dev              # API → localhost:3000
npm --prefix packages/web run dev              # Web → localhost:5173
```

### 빌드 (순서 중요)

```bash
npm --prefix packages/shared run build         # 1. shared
npm --prefix packages/api run build            # 2. API
npm --prefix packages/web run build            # 3. Web
```

### 유용한 명령어

```bash
npm --prefix packages/api exec prisma studio   # DB GUI (localhost:5555)
```

---

## 배포

| 영역 | 플랫폼 | 비고 |
|------|--------|------|
| Backend | Docker | 자체 서버 |
| Frontend | Vercel | GitHub 연동 자동 배포 |
| API Proxy | Vercel rewrites | `/api/*` → Backend |
| pgAdmin | Docker | 개발용 |

### Vercel 설정

| 항목 | 값 |
|------|-----|
| Framework Preset | Other |
| Root Directory | `.` (레포 루트) |
| 빌드/출력/설치 | `vercel.json`에 정의됨 |
| 환경변수 | `VITE_API_BASE_URL` = Backend API URL |

> 초기 관리자 계정, 서버 URL 등 민감정보는 `CLAUDE.md` 또는 내부 문서 참조

---

## 외부 API 연동

```
┌───────────────────────────────────┐
│           KMS 시스템               │
│  문서 저장 + 분류 + 관계 + 뷰어    │
│  REST API (/api/v1/*)             │
└──────────────┬────────────────────┘
               │
         [X-API-Key]
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────┐          ┌─────────┐
│ RAG 업체 │          │ 미래 업체 │
└─────────┘          └─────────┘
```

외주 교체: API Key 발급 → 매뉴얼 전달 → 끝 (1일)

---

## 허용 파일 형식

| 형식 | 허용 | 뷰어 |
|------|------|------|
| PDF | O | pdf.js (iframe) |
| Markdown | O | marked.js |
| CSV | O | 테이블 렌더링 |
| Word/PPT/Excel | **X** | 업로드 차단 |

---

## 참고 문서

| 문서 | 위치 |
|------|------|
| 프로젝트 규칙 | `CLAUDE.md` |
| DB 스키마 정본 | `docs/phase2/database-schema.md` |
| Phase 2 상세 | `docs/phase2/README.md` |

---

## 라이선스

Private - Internal Use Only
