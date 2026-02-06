# KMS 지식관리체계 프로젝트

## 프로젝트 목표

**AI RAG 구축 전, 전사 지식체계 관리 시스템 구축**

보험 GA(법인보험대리점)의 문서/지식을 체계적으로 분류하고 관리하여,
향후 RAG(Retrieval-Augmented Generation) 시스템의 기반 데이터를 준비한다.

## 프로젝트 단계

| 단계 | 목표 | 상태 |
|------|------|------|
| **Phase 1** | 문서 분류체계 검증 (Admin 페이지) | 현재 |
| **Phase 2** | 전사 지식관리 시스템 구축 (Vue 앱) | 예정 |
| **Phase 3** | AI RAG 시스템 연동 | 예정 |

### 현재: Phase 1 - 분류체계 검증

**목표: 문서관리 체계 도입 전 시뮬레이션 및 검증**

#### 핵심 검증 항목

1. **문서 전파 검증**
   - 특정 문서 선택 시 연관 문서들이 의도대로 전파되는지
   - 부모-자식-형제-참조 관계가 정확히 동작하는지

2. **유니크 보장**
   - 분류체계상 동일 경로에 중복 문서 불가
   - 경로: `보험사 > 상품 > 문서유형`
   - 예: `KB손해보험 > 든든 어린이보험 > 상품요약본` → 유니크

3. **버전/개편 대응**
   - 상품 개편 시 새 상품으로 등록 (예: "든든 어린이보험 리뉴얼(2026-02)")
   - 기존 상품과 별개 엔티티로 관리
   - 연관관계로 "이전 버전" 참조 가능

4. **업로드 시 자동 분류**
   - 파일명에서 보험사/상품/문서유형 추출
   - 기존 데이터와 매칭하여 자동 제안
   - 중복 감지 시 경고

#### 검증 시나리오

```
[시나리오 1: 문서 전파]
시책 문서 선택 → 연관된 수수료, 상품설명서가 함께 조회되는가?

[시나리오 2: 유니크 검증]
같은 경로에 문서 추가 시도 → 중복 경고 발생하는가?

[시나리오 3: 상품 개편]
"든든 어린이보험 리뉴얼(2026-02)" 업로드
→ 기존 "든든 어린이보험"과 별개로 등록되는가?
→ 두 상품 간 "SUPERSEDES" 관계 설정 가능한가?

[시나리오 4: 자동 분류]
"KB손해_든든어린이_상품요약_202602.pdf" 업로드
→ 보험사: KB손해보험, 상품: 든든 어린이보험, 유형: 상품요약본 자동 제안
```

#### 기술 구현
- JSON 기반 단일 HTML 페이지
- 서버 없이 브라우저에서 동작
- localStorage + JSON 파일로 데이터 관리

## 기술 스택

### 프론트엔드 고정 (회사 표준)

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | **Vue 3** | 필수 |
| 라우팅 | **Vue Router** | 필수 |
| 상태관리 | **Pinia** | 필수 |
| 빌드 | Vite | Vue 팀 제작 |
| 언어 | **JavaScript** | TypeScript 미사용 |

### Vue 생태계 선택 가능

| 분류 | 선택지 | 권장 |
|------|--------|------|
| HTTP | Axios | O |
| 유틸리티 | VueUse | O (컴포저블 모음) |
| UI 컴포넌트 | Element Plus / Naive UI | 선택 |
| 폼 검증 | VeeValidate | 선택 |
| 차트 | ECharts + vue-echarts | 선택 |
| 알림 | Vue-Toastification | 선택 |

### Phase 1 검증용 (현재)

| 영역 | 기술 | 비고 |
|------|------|------|
| 경량 Vue | Petite-Vue | 단일 HTML 파일용 |
| 스타일링 | Tailwind CSS | CDN |
| 그래프 | vis-network | CDN |
| 데이터 | localStorage + JSON | 서버 불필요 |

## 디렉토리 구조

```
/
├── CLAUDE.md                        # 프로젝트 규칙
├── README.md                        # 프로젝트 소개
├── .gitignore
├── package.json
│
├── src/                             # Python 소스
│   ├── taxonomy.py                  # 마스터 데이터 정의
│   ├── ontology.py                  # 온톨로지 클래스/관계/동의어
│   ├── simulator.py                 # 데이터 시뮬레이터
│   ├── simulator_ontology.py        # 온톨로지 그래프 생성
│   ├── simulator_golden.py          # Golden Set 검증 시뮬레이터
│   ├── verifier.py                  # 데이터 검증기
│   ├── ontology_validator.py        # 온톨로지 검증기
│   ├── rag_simulator.py             # RAG 시뮬레이터
│   ├── warehouse_api.py             # Warehouse API (데이터 접근 계층)
│   ├── golden_set.py                # Golden Set 정의
│   └── doc_templates.py             # 문서 템플릿
│
├── data/                            # 생성 데이터
│   ├── taxonomy.json                # 분류체계 JSON
│   ├── knowledge-graph.json         # 지식 그래프
│   ├── knowledge-graph-ontology.json # 온톨로지 그래프
│   └── samples/                     # 샘플 보험 문서 (260개)
│
├── ui/                              # 프론트엔드
│   ├── admin.html                   # Admin 페이지
│   └── viewer.html                  # 그래프 뷰어
│
├── tests/                           # 테스트
│   └── scenarios.js                 # Playwright 시나리오
│
└── docs/                            # 문서
    ├── core/                        # 핵심 문서
    │   ├── project-goal.md
    │   ├── domain-knowledge.md
    │   └── AI_Knowledge_Architecture_Strategy.pdf
    ├── architecture/                # 설계 문서
    │   ├── architecture-guide.md
    │   ├── document-pipeline.md
    │   ├── ontology-design.md
    │   └── strategy-alignment.md
    ├── results/                     # 검증 결과
    │   ├── ontology-validation.json
    │   ├── golden-set-validation.json
    │   └── rag-simulation.json
    └── changelog.md                 # 변경 이력
```

## 핵심 도메인 개념

### 3-Axis Taxonomy

- **WHO**: 보험사 (Carrier) - `INS-SAMSUNG`, `INS-HANWHA`, `INS-KYOBO`
- **WHAT**: 상품군 (Product) - `PRD-LIFE-WHOLE`, `PRD-CHILD`
- **WHICH**: 문서유형 (DocType) - `DOC-TERMS`, `DOC-GUIDE`, `DOC-SCRIPT`, `DOC-INCENTIVE`, `DOC-COMMISSION`, `DOC-TRAINING`

### Hot-Warm-Cold 티어

| Tier | 문서유형 | 변경빈도 |
|------|----------|----------|
| HOT | 시책, 수수료 | 수시 |
| WARM | 상품설명서, 스크립트 | 분기 |
| COLD | 약관, 교육자료 | 연간 |

### 문서 ID 규칙

```
{DOC-TYPE}-{CARRIER}-{PRODUCT}-{SEQ}
예: DOC-TERMS-INS-SAMSUNG-PRD-LIFE-WHOLE-001
```

### 관계 유형

| 관계 | 설명 | 양방향 |
|------|------|--------|
| parent/children | 부모-자식 | O |
| siblings | 형제 | O |
| references | 참조 | X |
| supersedes | 상품 개편 (신→구) | X |

### 유니크 제약 조건

**문서 유니크 키**: `보험사 + 상품 + 문서유형 + 버전`

```
[유효한 경로 - 모두 유니크]
KB손해보험 > 든든 어린이보험 > 상품요약본 v1.0
KB손해보험 > 든든 어린이보험 > 판매강의자료 v1.0
KB손해보험 > 든든 어린이보험 리뉴얼(2026-02) > 상품요약본 v1.0

[중복 오류]
KB손해보험 > 든든 어린이보험 > 상품요약본 v1.0  (이미 존재)
```

### 자동 분류 규칙

**파일명 파싱 우선순위:**

1. **보험사 매칭**: 파일명에서 보험사 코드/별칭 검색
   - "KB손해", "KB", "케이비" → KB손해보험
   - "삼성생명", "삼성", "SL" → 삼성생명

2. **상품 매칭**: 기존 등록된 상품명과 유사도 비교
   - "든든어린이", "든든 어린이" → 든든 어린이보험
   - 새 상품이면 신규 등록 제안

3. **문서유형 매칭**: 키워드 기반
   - "요약", "요약본" → 상품요약본
   - "강의", "교육" → 교육자료
   - "스크립트", "화법" → 판매스크립트

4. **날짜/버전 추출**: 정규식
   - "202602", "2026-02" → 2026년 2월
   - "v2", "Ver.2" → 버전 2.0

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

## 주요 명령어

```bash
# 데이터 생성
python src/taxonomy.py         # 분류체계 JSON 내보내기
python src/simulator.py        # 지식 그래프 + 샘플 문서 생성
python src/simulator_ontology.py  # 온톨로지 그래프 생성

# 검증
python src/verifier.py         # 데이터 검증
python src/ontology_validator.py  # 온톨로지 검증
python src/simulator_golden.py    # Golden Set 검증
python src/rag_simulator.py       # RAG 시뮬레이션

# UI 확인
npx serve . -p 8080
# http://localhost:8080/ui/admin.html
# http://localhost:8080/ui/viewer.html
```

## 참고 문서

- `docs/core/project-goal.md` - 프로젝트 목표 및 단계별 계획
- `docs/core/domain-knowledge.md` - GA 산업 도메인 지식
- `docs/architecture/architecture-guide.md` - 전체 아키텍처
- `docs/architecture/document-pipeline.md` - 문서 파이프라인

## 주의사항

1. **Vue 필수**: 프론트엔드는 반드시 Vue 사용 (회사 정책)
2. **Phase 1 집중**: 현재는 JSON 기반 검증에만 집중
3. **과설계 금지**: 동작하는 코드 우선, 설계는 최소화
4. **도메인 용어**: 보험 업계 용어 정확히 사용
