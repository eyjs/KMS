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
| **Phase 2** | 체계 관리 시스템 | **현재** | .NET Core + Vue 3 + PostgreSQL |
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
| Frontend | Vue 3 | 3.4+ |
| UI | Element Plus | 2.x |
| 빌드 | Vite | 5.x |
| Backend | ASP.NET Core | 8.0 LTS |
| ORM | EF Core | 8.x |
| Database | PostgreSQL | 16 |
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
│
├── src/                             # Phase 1 Python 소스
│   ├── taxonomy.py                  # 마스터 데이터 정의
│   ├── ontology.py                  # 온톨로지 메타데이터
│   ├── simulator.py                 # 데이터 시뮬레이터
│   ├── verifier.py                  # 데이터 무결성 검증
│   └── ontology_validator.py        # 온톨로지 구조 검증
│
├── data/                            # 생성 데이터
│   ├── taxonomy.json
│   ├── knowledge-graph.json
│   └── knowledge-graph-ontology.json
│
├── ui/                              # Phase 1 프론트엔드
│   ├── admin.html
│   └── viewer.html
│
└── docs/                            # 문서
    ├── README.md                    # 문서 인덱스
    ├── phase1/                      # Phase 1 문서
    ├── phase2/                      # Phase 2 문서
    ├── phase3/                      # Phase 3 문서
    ├── architecture/                # 아키텍처 문서
    ├── problems/                    # CEO 보고용
    └── shared/                      # 공유 문서
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

### Phase 1 (검증용)

```bash
# 데이터 생성
python src/taxonomy.py
python src/simulator.py

# 검증
python src/verifier.py
python src/ontology_validator.py

# UI 확인
npx serve . -p 8080
```

### Phase 2 (개발 시)

```bash
# Backend
dotnet run --project src/KMS.Api

# Frontend
cd frontend && npm run dev
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
5. **IT팀 운영 가능**: .NET Core + Vue 3 (Python 없음)
