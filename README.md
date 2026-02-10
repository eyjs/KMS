# KMS - 문서관리 프레임워크

> 문서 체계 관리 시스템 (분류, 관계, 라이프사이클)

---

## 프로젝트 목표

**문서 체계 관리 시스템 구축**

- 문서 저장, 분류, 관계 관리에 집중
- 문서 처리(파싱, NLP)는 외주에 위임
- 데이터 주권 확보, 확장 가능하게 설계

---

## 프로젝트 단계

| 단계 | 목표 | 상태 | 기술 |
|------|------|------|------|
| **Phase 1** | 분류체계 검증 | **완료** | Python + JSON + HTML |
| **Phase 2** | 체계 관리 시스템 | **구현 완료** | NestJS + Vue 3 + TypeScript + PostgreSQL |
| **Phase 3** | 데이터 처리 확장 | 선택적 | Python 추가 (조건부) |

---

## Phase 2: 체계 관리 시스템 (현재)

### 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 언어 | TypeScript (풀스택) | 5.7+ |
| Frontend | Vue 3 + Composition API | 3.5+ |
| UI | Element Plus | 2.x |
| 빌드 | Vite | 6.x |
| Backend | NestJS | 10.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| PDF 뷰어 | pdf.js (iframe) | - |
| MD 뷰어 | marked.js | - |
| 그래프 | vis-network | 9.x |

### 범위

**포함 (직접 구현):**
- 파일 업로드 (PDF, Markdown, CSV만)
- 분류 선택 (보험사/상품/문서유형) + 코드 자동 생성
- 관계 관리 (부모-자식, 참조, 대체) + 관계 그래프 시각화
- 라이프사이클 (DRAFT → ACTIVE → DEPRECATED)
- 문서 뷰어 (PDF, Markdown, CSV 미리보기)
- 도메인 워크스페이스 (3-패널 레이아웃)
- 통합 검색 (정렬 + 검색이력 + URL 동기화)
- 키보드 단축키 (Ctrl+K → 검색)
- 대시보드 (통계 + 조치 필요 문서 + 최근 활동)
- 외부 API (REST + API Key)

**제외 (외주 위임):**
- PDF 텍스트 추출
- 한글 NLP
- 벡터 DB
- RAG/챗봇

### 허용 파일 형식

| 형식 | 허용 | 뷰어 |
|------|------|------|
| PDF | O | iframe (브라우저 내장) |
| Markdown | O | marked.js |
| CSV | O | 테이블 렌더링 |
| Word/PPT/Excel | **X** | 업로드 차단 |

### 프론트엔드 구조

```
/ (대시보드)                    → 통계 + 조치 필요 문서 + 최근 활동
/search                        → 통합 검색 (정렬, 이력, URL 동기화)
/d/:domainCode                 → 도메인 워크스페이스 (3-패널: 트리|목록|미리보기)
/d/:domainCode/doc/:id         → 문서 상세 (뷰어+이력+관계)
/d/:domainCode/compare?source= → 문서 비교/관계 설정
/admin/domains                 → 도메인/분류 관리
/admin/users                   → 사용자 관리
/login                         → 로그인
```

---

## Phase 1: 분류체계 검증 (완료)

### 달성 성과
- 시스템/도메인 분리 구조 검증
- 6개 GA 도메인 정의 완료
- 온톨로지 구조 검증 6/6 통과
- Admin UI 계층 탐색 동작

### 실행 방법

```bash
# 프로젝트 루트에서 실행
python scripts/taxonomy.py
python scripts/simulator.py
python scripts/verifier.py
python scripts/ontology_validator.py
```

---

## Phase 3: 데이터 처리 확장 (선택적)

### 진입 조건
- Phase 2 안정적 운영 (6개월+)
- 예산 추가 확보 (5,000만원+)
- Python 인력 확보

**조건 미충족 시: Phase 2 + 외주 RAG로 계속 운영**

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
│   │       ├── types.ts             # 엔티티, DTO, Enum
│   │       ├── constants.ts         # 도메인, 권한, 관계 정의
│   │       └── index.ts
│   ├── api/                         # @kms/api (NestJS 백엔드)
│   │   ├── src/
│   │   │   ├── prisma/              # DB 서비스
│   │   │   ├── auth/                # 인증 + 권한
│   │   │   ├── documents/           # 문서 CRUD + 통계 + 검색
│   │   │   ├── relations/           # 관계 관리
│   │   │   ├── taxonomy/            # 마스터 데이터 API
│   │   │   └── common/              # 필터, 인터셉터
│   │   └── prisma/
│   │       ├── schema.prisma        # DB 스키마
│   │       ├── triggers.sql         # 트리거
│   │       └── seed.ts              # 초기 데이터
│   └── web/                         # @kms/web (Vue 3 프론트엔드)
│       └── src/
│           ├── router/              # 라우터 + 라우트 가드
│           ├── stores/              # Pinia (auth, domain)
│           ├── api/                 # API 클라이언트
│           ├── views/               # 페이지 (Dashboard, Search, DomainWorkspace, DocumentDetail, ...)
│           ├── components/          # 컴포넌트 (common, document, domain, graph, layout, viewer)
│           └── composables/         # 재사용 로직 (키보드단축키, 검색이력, 최근문서)
│
├── scripts/                         # Phase 1 Python 검증 도구
│
├── legacy/                          # Phase 1 아카이브
│
└── docs/                            # 문서
```

---

## 개발 환경

### 사전 요구사항
- Node.js 20+
- PostgreSQL 16 (또는 Docker)

### 설치 및 실행

```bash
# 의존성 설치
npm install
npm --prefix packages/shared install
npm --prefix packages/api install
npm --prefix packages/web install

# shared 빌드 (먼저)
npm --prefix packages/shared run build

# DB 시작
docker compose up -d postgres

# Prisma 마이그레이션
npm --prefix packages/api exec prisma migrate dev
npm --prefix packages/api exec prisma db seed

# API 개발 서버
npm --prefix packages/api run dev

# Web 개발 서버
npm --prefix packages/web run dev
```

### 빌드

```bash
npm --prefix packages/shared run build
npm --prefix packages/web run build
npm --prefix packages/api run build
```

---

## 배포

| 영역 | 플랫폼 | URL |
|------|--------|-----|
| Backend | Docker (Mac Studio) | `https://kms.joonbi.co.kr` |
| Frontend | Vercel | Vercel 자동 배포 |
| API Proxy | Vercel rewrites | `/api/*` → Backend |

### 초기 관리자 계정
- 이메일: `admin`
- 비밀번호: `admin`
- 역할: `ADMIN`

> 프로덕션 배포 후 반드시 비밀번호 변경

---

## 라이선스

Private - Internal Use Only
