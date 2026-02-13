# KMS 문서관리 프레임워크 v4.0

## 프로젝트 목표

**문서 체계 관리 프레임워크 구축**

문서의 저장, 배치, 관계를 관리하는 범용 프레임워크를 구축한다.
문서 처리(파싱, NLP, 벡터화)는 외주에 위임하고, 체계 관리에 집중한다.
데이터 주권을 확보하면서 확장 가능하게 설계한다.

## 프로젝트 단계 (ADR-014)

| 단계 | 목표 | 상태 | 기술 |
|------|------|------|------|
| **Phase 1** | 분류체계 검증 | **완료** | Python + JSON + HTML |
| **Phase 2** | 문서 중앙집중화 + 체계 관리 + UX | **현재** | NestJS + Vue 3 + TypeScript + PostgreSQL |
| **Phase 3** | 미들웨어 + 외부 API 계층 | 다음 | REST API 고도화 + 미들웨어 |
| **Phase 4** | 자연어 쿼리 시스템 | 향후 | Full-text Search + NLQ 인터페이스 |
| **Phase 5** | AI RAG 시스템 | 향후 | Vector DB + RAG 파이프라인 |

### Phase 로드맵 요약

```
Phase 2 (현재): 사람이 문서를 올리고, 분류하고, 찾아 쓰게 만든다
    ↓ 문서가 충분히 쌓이고 분류되면
Phase 3: 외부 서버/시스템이 API로 문서 체계에 접근한다
    ↓ API가 안정화되면
Phase 4: 사용자가 자연어로 쿼리하여 문서를 검색한다
    ↓ 자연어 검색이 의도대로 동작하면
Phase 5: AI RAG 시스템을 연동하여 지능형 문서 활용
```

---

## Phase 2: 문서 중앙집중화 + 체계 관리 + UX (현재)

### 현재 집중사항

> **핵심 목표**: 사용자가 실제로 문서 시스템을 사용하게 만든다.
> 문서를 먼저 중앙집중화하고, 분류 체계를 잡아야 다음 단계로 갈 수 있다.

**Phase 2 남은 과제:**
- UX 최적화 — 업로드/배치/검색 워크플로우 마찰 최소화
- 파일 버전 이력 — 파일 교체 시 이전 버전 보존 (Wrapsody 참고)
- ROT 데이터 탐지 — 방치된 DRAFT, 오래된 orphan 문서 자동 식별
- 감사 로그 확장 — 문서 열람/다운로드 로그 기록, 사용자 활동 통계
- 로깅/에러 핸들링 고도화 — NestJS Logger, 구조화된 에러 응답

### 핵심 설계 원칙 (ADR-013)

> "보험업 문서관리 솔루션"에서 "범용 프레임워크"로 전환 (2026-02-11)

| # | 원칙 | 설명 |
|---|------|------|
| 1 | 업로드는 자유 | 파일만 올리면 됨. 도메인/분류 선택은 선택적 |
| 2 | 문서는 독립 엔티티 | 어떤 도메인에도 소속되지 않음 |
| 3 | 도메인 = 작업 공간 | 사용자가 만들고, 안에 카테고리 트리를 자유롭게 구성 |
| 4 | 문서-도메인 = M:N 바로가기 | Windows 바로가기 개념. 1회 업로드, N개 도메인에서 참조 |
| 5 | 파일 해시 중복 방지 | 동일 파일 업로드 시 SHA-256으로 차단 |
| 6 | 카테고리 = 도메인 내부 | 사용자가 자유롭게 생성하는 폴더 구조 |

### 워크플로우

```
업로드(파일만) → "내 문서" → 도메인에 배치(바로가기) → 카테고리 지정
```

### 구현 완료 기능

- 파일 업로드 (PDF, Markdown, CSV) — 도메인 선택 없이 업로드 가능
- 도메인 CRUD (무제한 깊이 트리 구조) + 코드 자동 생성
- 카테고리 CRUD (도메인 내 폴더 구조)
- 문서 배치 (DocumentPlacement) — 문서를 도메인/카테고리에 바로가기로 배치
- 문서 목록/검색/필터 + 도메인 워크스페이스 (3패널)
- 문서 상세 뷰어 (PDF, Markdown, CSV 미리보기)
- 관계 추가/삭제 UI + DocumentExplorer + 관계 그래프 (vis-network)
- 도메인별 관계 그래프 뷰
- 라이프사이클 전환 (DRAFT → ACTIVE → DEPRECATED)
- 대시보드 (통계 카드 + 조치 필요 문서 + 최근 활동)
- 통합 검색 (정렬 4종 + 검색이력 자동완성 + URL 상태 동기화)
- 키보드 단축키 (Ctrl+K → 검색)
- 사용자 관리 (JWT 인증, 업무 역할 기반 접근 제어)
- 피드백 시스템 (플로팅 버튼 + 페이지 URL 자동 캡처)
- 전역 에러 처리 (403/네트워크 에러 알림)

### 범위

**포함 (직접 구현):**
- 파일 업로드 (PDF, Markdown, CSV만)
- 도메인/카테고리 관리
- 문서 배치 (바로가기)
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

## Phase 3: 미들웨어 + 외부 API 계층 (다음)

> **전제 조건**: Phase 2에서 문서가 충분히 중앙집중화되고 분류 체계가 잡혀야 함

### 목표
외부 서버/시스템이 KMS 문서 체계에 접근하여 문서를 추출할 수 있는 API를 제공한다.

### 핵심 기능
- REST API 고도화 — 문서 검색/추출/메타데이터 조회 API
- API Key 인증 강화 — 클라이언트별 권한/할당량 관리
- 미들웨어 계층 — 요청 라우팅, 인증, 로깅, 레이트리밋
- 문서 파싱 추상화 (ADR-012) — PDF → 텍스트 추출 파이프라인
- Webhook/이벤트 — 문서 상태 변경 시 외부 시스템 알림
- 외부 공유 링크 — 만료/회수 가능한 문서 공유 토큰

### 기술 후보
- 문서 파싱: Python sidecar (PyMuPDF) 또는 Google Document AI
- 캐싱: Redis (선택적)

---

## Phase 4: 자연어 쿼리 시스템 (향후)

> **전제 조건**: Phase 3 API가 안정화되고, 문서 텍스트 추출이 가능해야 함

### 목표
사용자가 자연어로 쿼리하여 문서를 검색하고 가져오는 시스템을 구축한다.

### 핵심 기능
- Full-text Search 고도화 — PostgreSQL ts_vector 또는 Elasticsearch
- 자연어 쿼리 인터페이스 — "영업팀 최신 계약서 찾아줘" → 검색 결과
- 시맨틱 검색 — 텍스트 임베딩 기반 유사도 검색
- 검색 품질 평가 — 의도대로 동작하는지 검증

---

## Phase 5: AI RAG 시스템 (향후)

> **전제 조건**: Phase 4 자연어 검색이 의도대로 동작하면 진행

### 목표
AI RAG(Retrieval-Augmented Generation) 시스템을 연동하여 지능형 문서 활용 환경을 구축한다.

### 핵심 기능
- Vector DB 구축 — 문서 임베딩 저장/검색
- RAG 파이프라인 — 쿼리 → 관련 문서 검색 → LLM 생성
- AI 챗봇 — 문서 기반 Q&A, 요약, 비교
- AI 문서 요약/분류 자동화

### 기술 후보
- Vector DB: pgvector 또는 Pinecone/Weaviate
- LLM: OpenAI API 또는 Local LLM
- 임베딩: OpenAI Embeddings 또는 한국어 특화 모델

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
│   │       ├── constants.ts         # 라벨, 권한, 관계 정의
│   │       └── index.ts
│   ├── api/                         # @kms/api (NestJS 백엔드)
│   │   ├── src/
│   │   │   ├── prisma/              # DB 서비스
│   │   │   ├── auth/                # 인증 + 권한 (JWT, API Key, 역할, 보안등급)
│   │   │   ├── documents/           # 문서 CRUD + 업로드 + 라이프사이클
│   │   │   ├── placements/          # 문서 배치 (바로가기)
│   │   │   ├── categories/          # 도메인 카테고리 (폴더)
│   │   │   ├── relations/           # 관계 관리 (순환 방지)
│   │   │   ├── taxonomy/            # 도메인 마스터 API
│   │   │   ├── feedback/            # 사용자 피드백
│   │   │   └── common/              # 필터, 인터셉터
│   │   └── prisma/
│   │       ├── schema.prisma        # DB 스키마
│   │       ├── triggers.sql         # 트리거 (순환방지)
│   │       └── seed.ts              # 초기 데이터 (admin/admin만)
│   └── web/                         # @kms/web (Vue 3 프론트엔드)
│       └── src/
│           ├── router/              # 라우터 + 라우트 가드
│           ├── stores/              # Pinia (auth, domain)
│           ├── api/                 # API 클라이언트
│           ├── views/               # 페이지
│           ├── components/
│           │   ├── common/          # StatusTag
│           │   ├── document/        # DocumentExplorer, DocumentPreview, DocumentTable, DocumentTimeline
│           │   ├── domain/          # CategoryTree, UploadDialog, PlacementDialog
│           │   ├── graph/           # RelationGraph (vis-network)
│           │   ├── layout/          # AppLayout
│           │   └── viewer/          # PdfViewer, MarkdownViewer, CsvViewer
│           └── composables/         # useKeyboardShortcuts, useSearchHistory, useRecentDocs
│
├── scripts/                         # Python 검증 도구 (Phase 1)
│
└── docs/                            # 문서
    ├── architecture/
    │   └── decision-log.md          # 아키텍처 의사결정 기록 (ADR)
    ├── phase2/
    │   └── database-schema.md       # DB 스키마 정본
    └── handoff.md                   # 세션 핸드오프
```

---

## 프레임워크 구조

### 핵심 모델: 원본 + 바로가기

```
Document (원본, 도메인 무관)
    │
    │  file_hash (SHA-256) — 동일 파일 중복 방지
    │
    ├──── DocumentPlacement (바로가기 1) ──→ DomainA / CategoryX
    ├──── DocumentPlacement (바로가기 2) ──→ DomainB / CategoryY
    └──── DocumentPlacement (바로가기 3) ──→ DomainC / (루트)

DomainMaster (트리)
    └── DomainCategory (폴더 구조)
```

**Windows 탐색기 메타포:**
- 원본 파일은 한 곳에만 존재
- 여러 폴더에 "바로가기"를 만들어 배치
- 원본을 수정하면 모든 바로가기에서 최신 내용이 보임
- 바로가기를 삭제해도 원본은 안 사라짐

### 라이프사이클 상태 머신

```
DRAFT ←→ ACTIVE → DEPRECATED
```

| 상태 | 설명 | 전환 가능 |
|------|------|----------|
| DRAFT | 작성 중 | → ACTIVE |
| ACTIVE | 유효한 문서 | → DRAFT, → DEPRECATED |
| DEPRECATED | 만료됨 | (종료 상태) |

### 관계 유형

| 관계 | 설명 | 양방향 | 도메인 필수 |
|------|------|--------|------------|
| PARENT_OF / CHILD_OF | 부모-자식 | O | O |
| SIBLING | 형제 | O | O |
| REFERENCE | 참조 | X | O |
| SUPERSEDES | 버전 대체 | X | X |

### 중복 방지 (SSOT 대체)

- **file_hash (SHA-256)**: 동일 파일 업로드 차단
- 분류 기반 SSOT는 폐기됨 (ADR-013)

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

## 데이터베이스 설계

> **정본**: `docs/phase2/database-schema.md` 참조

### 핵심 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 (JWT 인증용) |
| `domain_master` | 도메인 트리 (작업 공간) |
| `domain_categories` | 도메인 내 카테고리 (폴더 구조) |
| `documents` | 문서 메타데이터 (원본) |
| `document_placements` | 문서-도메인 배치 (바로가기, M:N) |
| `relations` | 문서 간 관계 |
| `document_history` | 변경 이력 |
| `feedback` | 사용자 피드백 |
| `api_keys` | 외부 API 인증 |

### 폐기된 테이블 (ADR-013)

| 테이블 | 폐기 이유 |
|--------|----------|
| `facet_type_master` | facet 개념 폐기 |
| `facet_master` | facet 개념 폐기 |
| `classifications` | EAV 분류 체계 폐기 |

### 주요 제약조건

| 제약 | 구현 |
|------|------|
| 파일 중복 방지 | `documents.file_hash` UNIQUE |
| 배치 중복 방지 | `document_placements(document_id, domain_code)` UNIQUE |
| 순환 참조 방지 | 트리거 (PARENT_OF, CHILD_OF) |
| 낙관적 잠금 | row_version 자동 증가 |

---

## 코딩 컨벤션

### 파일명
- kebab-case: `document-explorer.vue`, `decision-log.md`

### JavaScript/Vue
- 변수/함수: camelCase
- 컴포넌트: PascalCase
- 상수: SCREAMING_SNAKE_CASE

### 한국어 사용
- 주석: 한국어
- 커밋 메시지: 한국어
- UI 텍스트: 한국어

### 상수 중앙집중화
- 모든 라벨/태그 타입은 `@kms/shared/constants.ts`에서 관리
- 컴포넌트에서 로컬 상수 정의 금지

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

---

## 배포 가이드

### 백엔드 (Docker)

#### 환경변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 접속 URL | `postgresql://kms:비밀번호@호스트:5432/kms?schema=public` |
| `JWT_SECRET` | JWT 서명 키 (필수) | 32자 이상 랜덤 문자열 |
| `JWT_EXPIRES_IN` | 액세스 토큰 만료 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | 리프레시 토큰 만료 | `7d` |
| `API_PORT` | 서버 포트 | `3000` |
| `STORAGE_PATH` | 파일 저장 경로 | `/app/storage/originals` |
| `CORS_ORIGIN` | 허용 Origin | `https://kms-web.vercel.app` |

#### 초기 관리자 계정
- 이메일: `admin`
- 비밀번호: `admin`
- 역할: `ADMIN`

> 프로덕션 배포 후 반드시 비밀번호 변경

### 프론트엔드 (Vercel)

| 설정 | 값 |
|------|-----|
| Framework Preset | Other |
| Root Directory | `.` (레포 루트) |
| 환경변수 | `VITE_API_BASE_URL=https://kms.joonbi.co.kr/api` |

---

## 참고 문서

- `docs/architecture/decision-log.md` — **아키텍처 의사결정 기록 (ADR-001~013)**
- `docs/phase2/database-schema.md` — DB 스키마 정본
- `docs/handoff.md` — 세션 핸드오프

---

## 핵심 원칙

1. **프레임워크 > 솔루션**: 업종 특화 로직을 강제하지 않음
2. **업로드는 자유**: 파일만 올리면 됨, 분류는 나중에
3. **원본 + 바로가기**: 문서는 독립 엔티티, 도메인에는 바로가기로 배치
4. **체계 관리 집중**: 문서 처리(파싱/NLP)는 외주 위임
5. **풀스택 TypeScript**: NestJS + Vue 3 (타입 공유)
