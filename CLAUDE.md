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

### 범위

**포함 (직접 구현):**
- 파일 업로드 (PDF, Markdown, CSV만)
- 분류 선택 (보험사/상품/문서유형)
- 관계 관리 (부모-자식, 참조, 대체)
- 라이프사이클 (DRAFT → ACTIVE → DEPRECATED)
- 문서 뷰어 (pdf.js, marked.js, 테이블)
- 관계 그래프 (vis-network)
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
| Monorepo | pnpm workspace + Turbo | - |
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
├── pnpm-workspace.yaml              # Monorepo 설정
├── turbo.json                       # Turbo 빌드 파이프라인
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
│           ├── stores/              # Pinia 상태관리
│           ├── api/                 # API 클라이언트
│           ├── views/               # 페이지 컴포넌트
│           ├── components/          # 공통 컴포넌트
│           └── composables/         # 재사용 로직
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
├── GA-SALES: carrier × product × docType
├── GA-COMM: carrier × product × docType
└── ... (도메인별 facet 정의)
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
| PUBLIC | 공개 | 외부업체 포함 전체 |
| INTERNAL | 사내용 | 직원 이상 |
| CONFIDENTIAL | 대외비(2급) | 팀장 이상 |
| SECRET | 기밀(1급) | 임원 이상 |

**사용자 역할:**
| 역할 | 설명 | 수준 |
|------|------|------|
| EXTERNAL | 외부업체 (RAG 구축용) | 0 |
| EMPLOYEE | 일반 직원 | 1 |
| TEAM_LEAD | 팀장급 | 2 |
| EXECUTIVE | 임원급 | 3 |
| ADMIN | 시스템 관리자 | 4 |

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
pnpm install                          # 의존성 설치
docker compose up -d postgres         # DB 시작
pnpm db:migrate                       # 마이그레이션
pnpm db:seed                          # 시드 데이터

# 개발 서버
pnpm dev                              # API + Web 동시 실행
pnpm --filter @kms/api dev            # API만
pnpm --filter @kms/web dev            # Web만

# 빌드
pnpm build                            # 전체 빌드
pnpm --filter @kms/shared build       # shared만

# Prisma
pnpm --filter @kms/api prisma studio  # DB GUI
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
- Node.js 20+ / pnpm 9+ (빌드용)

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
pnpm install
pnpm --filter @kms/shared build

# Prisma 클라이언트 생성
pnpm --filter @kms/api exec prisma generate

# API 빌드
pnpm --filter @kms/api build
```

빌드 결과: `packages/api/dist/`

#### 3. DB 마이그레이션

```bash
# 개발용 (자동 생성)
pnpm --filter @kms/api exec prisma migrate dev

# 프로덕션 (적용만)
pnpm --filter @kms/api exec prisma migrate deploy

# 시드 데이터 (최초 1회)
pnpm --filter @kms/api exec prisma db seed
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
pnpm --filter @kms/api start:prod

# 또는 Docker로 API 실행 (Dockerfile 작성 필요 시)
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
- 이메일: `admin@company.com`
- 비밀번호: `admin123`
- 역할: `ADMIN`

> 프로덕션 배포 후 반드시 비밀번호 변경

---

### 프론트엔드 (Vercel)

#### 1. Vercel 프로젝트 설정

| 설정 | 값 |
|------|-----|
| Framework Preset | Vue.js |
| Root Directory | `packages/web` |
| Build Command | `cd ../.. && pnpm install && pnpm --filter @kms/shared build && cd packages/web && npx vite build` |
| Output Directory | `dist` |
| Install Command | (비워두기 — Build Command에서 처리) |

#### 2. 환경변수 (Vercel Dashboard)

| 변수 | 값 |
|------|-----|
| `VITE_API_BASE_URL` | `https://kms.joonbi.co.kr/api` |

#### 3. API 프록시 설정

`packages/web/vercel.json` 생성:
`packages/web/vercel.json`에 이미 설정됨:
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://kms.joonbi.co.kr/api/:path*" }
  ]
}
```

#### 4. 배포

```bash
# Vercel CLI
npx vercel --prod

# 또는 GitHub 연동 시 push하면 자동 배포
```

#### 5. 빌드 순서 주의사항

Vercel에서 빌드 시 `@kms/shared`가 먼저 빌드되어야 합니다.
Build Command에서 shared를 먼저 빌드하는 이유:
```
pnpm --filter @kms/shared build → packages/shared/dist/ 생성
→ @kms/web의 tsconfig paths가 ../shared/dist 참조
→ vite build 성공
```

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
