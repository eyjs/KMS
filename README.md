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
| **Phase 2** | 체계 관리 시스템 | **현재** | .NET Core + Vue 3 + PostgreSQL |
| **Phase 3** | 데이터 처리 확장 | 선택적 | Python 추가 (조건부) |

---

## Phase 1: 분류체계 검증 (완료)

### 달성 성과
- 시스템/도메인 분리 구조 검증
- 6개 GA 도메인 정의 완료
- 온톨로지 구조 검증 6/6 통과
- Admin UI 계층 탐색 동작

### 실행 방법

```bash
# 데이터 생성
python src/taxonomy.py              # 분류체계 JSON
python src/simulator.py             # 지식 그래프 생성
python src/simulator_ontology.py    # 온톨로지 그래프 생성

# 검증
python src/verifier.py              # 데이터 무결성 검증
python src/ontology_validator.py    # 온톨로지 구조 검증

# Admin UI
npx serve . -p 8080
# http://localhost:8080/ui/admin-v3.html
```

---

## Phase 2: 체계 관리 시스템 (현재)

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
- 벡터 DB
- RAG/챗봇

### 허용 파일 형식

| 형식 | 허용 | 뷰어 |
|------|------|------|
| PDF | O | pdf.js |
| Markdown | O | marked.js |
| CSV | O | 테이블 렌더링 |
| Word/PPT/Excel | **X** | 업로드 차단 |

### 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vue 3 + Element Plus |
| Backend | ASP.NET Core 8 |
| Database | PostgreSQL 16 |

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
KMS/
├── CLAUDE.md               # 프로젝트 규칙
├── README.md               # 이 파일
│
├── src/                    # Phase 1 Python 소스
│   ├── taxonomy.py         # 분류체계 정의
│   ├── simulator.py        # 데이터 시뮬레이터
│   └── verifier.py         # 무결성 검증
│
├── ui/                     # Phase 1 Admin UI
│   ├── admin-v3.html       # 계층 탐색 페이지
│   └── viewer.html         # 그래프 뷰어
│
├── tests/                  # 테스트
│   └── scenarios.js        # Playwright 시나리오
│
└── docs/                   # 문서
    ├── README.md           # 문서 인덱스
    ├── phase1/             # Phase 1 문서
    ├── phase2/             # Phase 2 설계
    ├── phase3/             # Phase 3 계획
    ├── reports/            # 주체별 보고서
    ├── problems/           # 프로젝트 분석
    └── architecture/       # 기술 결정
```

---

## 문서 안내

| 대상 | 문서 |
|------|------|
| 임원/결정권자 | `docs/reports/report-executive.md` |
| 현업 담당자 | `docs/reports/report-field-user.md` |
| IT팀/개발자 | `docs/reports/report-developer.md` |

---

## 라이선스

Private - Internal Use Only
