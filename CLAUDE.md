# KMS 문서관리 프레임워크 v3.1

## 프로젝트 목표

**문서 체계 관리 시스템 구축**

문서의 저장, 분류, 관계를 관리하는 시스템을 구축한다.
문서 처리(파싱, NLP, 벡터화)는 외주에 위임하고, 체계 관리에 집중한다.
데이터 주권을 확보하면서 확장 가능하게 설계한다.

## 프로젝트 단계

| 단계 | 목표 | 상태 | 기술 |
|------|------|------|------|
| **Phase 1** | 분류체계 검증 | **완료** | Python + JSON + HTML |
| **Phase 2** | 체계 관리 시스템 | **현재** | NestJS + Vue 3 + TypeScript + PostgreSQL |
| **Phase 3** | 데이터 처리 확장 | 선택적 | Python 추가 (조건부) |

---

## Phase 1: 분류체계 검증 (완료)

### 달성 성과
- 시스템/도메인 분리 구조 검증
- 6개 GA 도메인 정의 완료
- 온톨로지 구조 검증 6/6 통과
- 지식 그래프 840노드/2,439엣지 생성
- Admin UI 계층 탐색 동작

### 기술 구현
- JSON 기반 단일 HTML 페이지
- 서버 없이 브라우저에서 동작
- localStorage + JSON 파일로 데이터 관리

---

## Phase 2: 체계 관리 시스템 (현재)

### 목표
문서 업로드, 분류, 관계 관리, 뷰어, 외부 API 제공

### 구현 완료 기능
- 파일 업로드 (PDF, Markdown, CSV) + 분류 선택
- 도메인 CRUD (무제한 깊이 트리 구조) + 코드 자동 생성
- Facet CRUD (보험사/상품/문서유형 관리) + 코드 자동 생성
- 문서 목록/검색/필터 + 도메인 워크스페이스 (3패널)
- 문서 상세 뷰어 (PDF, Markdown, CSV 미리보기)
- 관계 추가/삭제 UI + DocumentExplorer (도메인/분류 탐색) + 관계 그래프 (vis-network)
- 문서 분류/보안등급 수정 다이얼로그
- 라이프사이클 전환 (DRAFT → ACTIVE → DEPRECATED)
- 대시보드 (통계 카드 클릭 네비게이션 + 조치 필요 문서 + 최근 활동)
- 통합 검색 (정렬 4종 + 검색이력 자동완성 + URL 상태 동기화)
- 키보드 단축키 (Ctrl+K → 검색)
- 사용자 관리 (JWT 인증, 업무 역할 기반 접근 제어)
- 전역 에러 처리 (403/네트워크 에러 알림)

### 범위

**포함 (직접 구현):**
- 파일 업로드 (PDF, Markdown, CSV만)
- 분류 선택 (보험사/상품/문서유형)
- 관계 관리 (부모-자식, 참조, 대체)
- 라이프사이클 (DRAFT → ACTIVE → DEPRECATED)
- 문서 뷰어 (pdf.js, marked.js, 테이블)
- 외부 API (REST + API Key)

**제외 (외주 위임):**
- PDF 텍스트 추출
- 한글 NLP
- 벡터 DB 구축
- RAG/챗봇

### 허용 파일 형식

| 형식 | 허용 | 뷰어 |
|------|------|------|
| PDF | O | pdf.js |
| Markdown | O | marked.js |
| CSV | O | 테이블 렌더링 |
| Word/PPT/Excel | **X** | 업로드 차단 |

---

## Phase 3: 데이터 처리 확장 (선택적)

### 진입 조건
- Phase 2 안정적 운영 (6개월+)
- 예산 추가 확보 (5,000만원+)
- Python 인력 확보

### 확장 내용
- Python 코어 엔진 추가
- 문서 텍스트 추출 내재화
- 벡터 DB 연동 (pgvector)
- RAG 내재화 (외주 종료)

**조건 미충족 시: Phase 2 + 외주 RAG로 계속 운영**

---

## 기술 스택

### Phase 2 (확정)

| 영역 | 기술 | 버전 |
|------|------|------|
| 언어 | TypeScript (풀스택) | 5.7+ |
| Frontend | Vue 3 + Composition API | 3.5+ |
| UI | Element Plus | 2.x |
| 빌드 | Vite | 6.x |
| Backend | NestJS | 10.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| Monorepo | npm (workspaces 미사용) | - |
| PDF 뷰어 | pdf.js | - |
| MD 뷰어 | marked.js | - |
| 그래프 | vis-network | 9.x |

### Phase 1 (검증용)

| 영역 | 기술 |
|------|------|
| 프레임워크 | Vue 3 CDN |
| 스타일링 | Tailwind CSS |
| 그래프 | vis-network |
| 데이터 | localStorage + JSON |

---

## 디렉토리 구조

```
/
├── CLAUDE.md                        # 프로젝트 규칙 (이 파일)
├── README.md                        # 프로젝트 소개
├── vercel.json                      # Vercel 배포 설정
├── docker-compose.yml               # PostgreSQL + pgAdmin
│
├── packages/
│   ├── shared/                      # @kms/shared (타입 + 상수)
│   │   └── src/
│   │       ├── types.ts             # 엔티티, DTO, Enum
│   │       ├── constants.ts         # 도메인, 권한, 관계 정의
│   │       └── index.ts
│   ├── api/                         # @kms/api (NestJS 백엔드)
│   │   ├── src/
│   │   │   ├── prisma/              # DB 서비스
│   │   │   ├── auth/                # 인증 + 권한 (JWT, API Key, 역할, 보안등급)
│   │   │   ├── documents/           # 문서 CRUD + 업로드 + 라이프사이클
│   │   │   ├── relations/           # 관계 관리 (순환 방지, scope 검증)
│   │   │   ├── taxonomy/            # 마스터 데이터 API
│   │   │   └── common/              # 필터, 인터셉터
│   │   └── prisma/
│   │       ├── schema.prisma        # DB 스키마
│   │       ├── triggers.sql         # 트리거 (SSOT, 순환방지)
│   │       └── seed.ts              # 초기 데이터
│   └── web/                         # @kms/web (Vue 3 프론트엔드)
│       └── src/
│           ├── router/              # 라우터 + 라우트 가드
│           ├── stores/              # Pinia (auth, domain)
│           ├── api/                 # API 클라이언트 (client, documents, relations, taxonomy, admin, search)
│           ├── views/               # 페이지 (Dashboard, Search, DomainWorkspace, DocumentDetail, DocumentCompare, Login, Admin*)
│           ├── components/
│           │   ├── common/          # StatusTag
│           │   ├── document/        # DocumentExplorer, DocumentPreview, DocumentTable, DocumentTimeline
│           │   ├── domain/          # ClassificationTree, UploadDialog, DomainMenuItem
│           │   ├── graph/           # RelationGraph (vis-network)
│           │   ├── layout/          # AppLayout
│           │   └── viewer/          # PdfViewer, MarkdownViewer, CsvViewer
│           └── composables/         # useKeyboardShortcuts, useSearchHistory, useRecentDocs
│
├── scripts/                         # Python 코어 검증 도구
│   ├── taxonomy.py
│   ├── simulator.py
│   ├── verifier.py
│   └── ontology_validator.py
│
├── legacy/                          # Phase 1 아카이브
│   ├── ui/                          # Phase 1 HTML UI
│   └── data/                        # Phase 1 생성 데이터
│
└── docs/                            # 문서
    ├── phase1/
    ├── phase2/
    │   └── database-schema.md       # DB 스키마 정본
    ├── phase3/
    └── architecture/
```

---

## 프레임워크 구조

### 시스템 vs 도메인 분리

```
SYSTEM FRAMEWORK (불변)
├── 채번 (고유 ID)
├── 라이프사이클 (DRAFT → ACTIVE → DEPRECATED)
├── 신선도 (HOT/WARM/COLD)
├── 관계 (PARENT_OF, REFERENCE, SUPERSEDES)
├── SSOT (중복 방지)
└── 버전 (Major.Minor)

DOMAIN (가변)
└── GA (루트)
    ├── SALES: carrier × product × docType
    ├── COMM: carrier × product × docType
    ├── CONTRACT: carrier × product × docType
    ├── COMP: carrier × docType
    └── EDU: docType
```

### 라이프사이클 상태 머신

```
DRAFT → ACTIVE → DEPRECATED
```

| 상태 | 설명 | 전환 가능 |
|------|------|----------|
| DRAFT | 작성 중 | → ACTIVE |
| ACTIVE | 유효한 문서 | → DEPRECATED |
| DEPRECATED | 만료됨 | (종료 상태) |

> REVIEW, STALE, ARCHIVED는 Phase 3에서 검토

### 관계 유형

| 관계 | 설명 | 양방향 |
|------|------|--------|
| PARENT_OF / CHILD_OF | 부모-자식 | O |
| SIBLING | 형제 | O |
| REFERENCE | 참조 | X |
| SUPERSEDES | 버전 대체 | X |

### SSOT (Single Source of Truth)

동일 분류 경로에 ACTIVE 문서 1개만 허용

### 권한 체계 (문서 보안 등급 + 사용자 역할)

**문서 보안 등급:**
| 등급 | 설명 | 접근 가능 역할 |
|------|------|---------------|
| PUBLIC | 공개 | 전체 (VIEWER 이상) |
| INTERNAL | 사내용 | EDITOR 이상 |
| CONFIDENTIAL | 대외비(2급) | REVIEWER 이상 |
| SECRET | 기밀(1급) | APPROVER 이상 |

**사용자 역할 (업무 역할 기반, 직급 무관):**
| 역할 | 한국어 | 설명 | 수준 |
|------|--------|------|------|
| VIEWER | 조회자 | 공개 문서만 (외부업체, RAG 등) | 0 |
| EDITOR | 작성자 | 사내용까지 (문서 작성/수정) | 1 |
| REVIEWER | 검토자 | 대외비까지 (문서 검토/삭제) | 2 |
| APPROVER | 승인자 | 기밀까지 (최종 승인 권한) | 3 |
| ADMIN | 관리자 | 전체 (시스템 설정) | 4 |

---

## 데이터베이스 설계 (Phase 2)

> **정본**: `docs/phase2/database-schema.md` 참조

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

### 주요 제약조건

| 제약 | 구현 |
|------|------|
| 순환 참조 방지 | 트리거 (PARENT_OF, CHILD_OF) |
| SSOT | 트리거 (같은 hash + ACTIVE = 1개) |
| 낙관적 잠금 | row_version 자동 증가 |

---

## 코딩 컨벤션

### 파일명
- kebab-case: `kms-admin.html`, `document-pipeline.md`

### JavaScript/Vue
- 변수/함수: camelCase
- 컴포넌트: PascalCase
- 상수: SCREAMING_SNAKE_CASE

### 한국어 사용
- 주석: 한국어
- 커밋 메시지: 한국어
- UI 텍스트: 한국어

---

## 주요 명령어

### Phase 2 (개발)

```bash
# 환경 구축
npm install                                    # 루트 의존성
npm --prefix packages/shared install           # shared 의존성
npm --prefix packages/api install              # api 의존성
npm --prefix packages/web install              # web 의존성
docker compose up -d postgres                  # DB 시작

# shared 빌드 (먼저)
npm --prefix packages/shared run build

# DB 마이그레이션 + 시드
npm --prefix packages/api exec prisma migrate dev
npm --prefix packages/api exec prisma db seed

# 개발 서버
npm --prefix packages/api run dev              # API (localhost:3000)
npm --prefix packages/web run dev              # Web (localhost:5173)

# 빌드 (순서 중요)
npm --prefix packages/shared run build         # 1. shared 먼저
npm --prefix packages/api run build            # 2. API
npm --prefix packages/web run build            # 3. Web

# Prisma
npm --prefix packages/api exec prisma studio   # DB GUI
```

### Python 검증 도구

```bash
# 프로젝트 루트에서 실행
python scripts/taxonomy.py
python scripts/simulator.py
python scripts/verifier.py
python scripts/ontology_validator.py
```

---

## 배포 가이드

### 백엔드 (Docker)

#### 사전 준비
- Docker + Docker Compose 설치
- Node.js 20+ (빌드용)

#### 1. 환경변수 설정

```bash
# packages/api/.env 생성 (프로덕션)
cp .env.example packages/api/.env
```

필수 환경변수:
| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 접속 URL | `postgresql://kms:비밀번호@호스트:5432/kms?schema=public` |
| `JWT_SECRET` | JWT 서명 키 (필수, 하드코딩 금지) | 32자 이상 랜덤 문자열 |
| `JWT_EXPIRES_IN` | 액세스 토큰 만료 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | 리프레시 토큰 만료 | `7d` |
| `API_PORT` | 서버 포트 | `3000` |
| `STORAGE_PATH` | 파일 저장 경로 | `/app/storage/originals` |
| `CORS_ORIGIN` | 허용 Origin | `https://kms-web.vercel.app` (Vercel 배포 후 실제 도메인으로 변경) |

#### 2. 빌드

```bash
# 의존성 설치 + shared 빌드
npm install
npm --prefix packages/shared run build

# Prisma 클라이언트 생성
npm --prefix packages/api exec prisma generate

# API 빌드
npm --prefix packages/api run build
```

빌드 결과: `packages/api/dist/`

#### 3. DB 마이그레이션

```bash
# 개발용 (자동 생성)
npm --prefix packages/api exec prisma migrate dev

# 프로덕션 (적용만)
npm --prefix packages/api exec prisma migrate deploy

# 시드 데이터 (최초 1회)
npm --prefix packages/api exec prisma db seed
```

마이그레이션 후 트리거 적용:
```bash
# PostgreSQL에 직접 실행
psql $DATABASE_URL -f packages/api/prisma/triggers.sql
```

#### 4. Docker 실행

```bash
# PostgreSQL + pgAdmin 시작
docker compose up -d

# API 서버 실행 (로컬)
npm --prefix packages/api run start:prod

# 또는 Docker로 API 실행
# packages/api/Dockerfile 참고
```

#### 5. 확인

```bash
# 헬스체크
curl http://localhost:3000/api

# Swagger 문서
# http://localhost:3000/api/docs

# pgAdmin
# http://localhost:5050 (admin@kms.local / admin)
```

#### 초기 관리자 계정
- 이메일: `admin`
- 비밀번호: `admin`
- 역할: `ADMIN`

> 프로덕션 배포 후 반드시 비밀번호 변경

---

### 프론트엔드 (Vercel)

#### 1. Vercel 프로젝트 설정

| 설정 | 값 |
|------|-----|
| Framework Preset | Other |
| Root Directory | `.` (레포 루트, 비워두기) |
| Build Command | (자동 — vercel.json에 정의됨) |
| Output Directory | (자동 — vercel.json에 정의됨) |
| Install Command | (자동 — vercel.json에 정의됨) |

> `vercel.json`이 레포 루트에 모든 설정을 포함하고 있음

#### 2. 환경변수 (Vercel Dashboard)

| 변수 | 값 |
|------|-----|
| `VITE_API_BASE_URL` | `https://kms.joonbi.co.kr/api` |

#### 3. API 프록시 설정

`packages/web/vercel.json` 생성:
레포 루트 `vercel.json`에 이미 설정됨 (빌드, 출력, API 프록시 포함)

#### 4. 배포

```bash
# Vercel CLI
npx vercel --prod

# 또는 GitHub 연동 시 push하면 자동 배포
```

#### 5. 빌드 순서 주의사항

Vercel에서 빌드 시 `@kms/shared`가 먼저 빌드되어야 합니다.
`vercel.json`의 Build Command에서 shared → web 순서로 빌드합니다.
Web은 vite alias로 shared 소스를 직접 읽으므로 ESM/CJS 충돌이 없습니다.

---

## 참고 문서

- `docs/phase2/README.md` - Phase 2 상세
- `docs/problems/final-design.md` - 최종 설계
- `docs/architecture/tech-stack-decision.md` - 기술 스택 결정 근거

---

## 핵심 원칙

1. **체계 관리 집중**: 문서 처리는 외주, 체계 관리만 직접
2. **허용 형식 제한**: PDF, Markdown, CSV만 (Word/PPT 차단)
3. **데이터 주권 확보**: 원본 + 분류체계 100% 소유
4. **확장성 열어두기**: Phase 3 인터페이스 정의만
5. **풀스택 TypeScript**: NestJS + Vue 3 (타입 공유)
