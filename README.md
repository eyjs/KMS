# KMS - 지식관리체계 시스템

> GA(법인보험대리점) 전사 도메인별 정적 리소스 통합 관리 시스템

AI RAG 시스템 구축 전, 전사 지식체계를 수립하고 검증하기 위한 프로젝트입니다.

## 프로젝트 목표

**GA 내 모든 도메인의 문서/지식을 체계적으로 분류하고 관리**

- 보험상품 (약관, 설명서, 시책, 수수료)
- 법률/규정 (감독규정, 보험업법, 컴플라이언스)
- 영업지원 (매뉴얼, 스크립트, 사례집)
- 내부운영 (시스템, 인사, 회계)
- 교육자료 (신입, 상품, 자격증)

## 프로젝트 단계

| 단계 | 목표 | 상태 |
|------|------|------|
| **Phase 1** | 보험상품 도메인으로 분류체계 검증 | 진행중 |
| **Phase 2** | 전체 도메인 확장 + Vue 앱 구축 | 예정 |
| **Phase 3** | AI RAG 시스템 연동 | 예정 |

## 핵심 기능

### 문서 분류 체계

**최종 목표**: GA(법인보험대리점) 내 모든 도메인의 정적 리소스 통합 관리

```
[GA 지식체계]
├── 보험상품        ← Phase A 검증 대상
│   ├── 보험사별
│   │   └── 상품별
│   │       └── 문서유형 (약관, 설명서, 시책, 수수료...)
│   └── 공통 (업계 표준, 비교자료...)
│
├── 법률/규정
│   ├── 금융감독원 규정
│   ├── 보험업법
│   └── 내부 컴플라이언스
│
├── 영업지원
│   ├── 영업 매뉴얼
│   ├── 고객 응대 스크립트
│   └── 사례집
│
├── 내부운영
│   ├── 시스템 가이드
│   ├── 인사/총무
│   └── 회계/정산
│
└── 교육
    ├── 신입 교육
    ├── 상품 교육
    └── 자격증 교육
```

**Phase 1 (현재)**: 보험상품 도메인으로 핵심 로직 검증
```
보험사 → 상품 → 문서유형
```

### 문서 관계

| 관계 | 설명 | 방향 |
|------|------|------|
| siblings | 형제 문서 | 양방향 |
| references | 참조 문서 | 단방향 |
| supersedes | 상품 개편 (신→구) | 단방향 |

### Hot-Warm-Cold 티어

| Tier | 문서유형 | 변경빈도 |
|------|----------|----------|
| HOT | 시책, 수수료 | 수시 |
| WARM | 상품설명서, 스크립트 | 분기 |
| COLD | 약관, 교육자료 | 연간 |

## 실행 방법

### 데이터 생성 + 검증

```bash
python src/taxonomy.py              # 분류체계 JSON 내보내기
python src/simulator.py             # 지식 그래프 + 샘플 문서 생성
python src/simulator_ontology.py    # 온톨로지 그래프 생성
python src/verifier.py              # 데이터 검증
python src/ontology_validator.py    # 온톨로지 검증
python src/simulator_golden.py      # Golden Set 검증
python src/rag_simulator.py         # RAG 시뮬레이션
```

### Admin 페이지 (Phase 1)

```bash
npx serve . -p 8080
# http://localhost:8080/ui/admin.html 접속
```

### 테스트 실행

```bash
npm install
npx serve . -p 8080 &
node tests/scenarios.js
```

## 화면 구성

### 그래프 뷰
- vis-network 기반 문서 관계 시각화
- 보험사(보라) → 상품(파랑) → 문서(HOT/WARM/COLD 색상)
- 노드 클릭 시 상세 정보 표시

### 목록 뷰
- 문서 테이블 (260+ 샘플)
- 문서 클릭 → 중앙에 내용 편집, 오른쪽에 메타데이터
- CRUD 지원 (생성/조회/수정/삭제)

### 검증 뷰
- 유니크 검증: 중복 문서 감지
- 전파 검증: 연관 문서 하이라이트
- 관계 규칙 표시
- 통계 대시보드

## 검증 시나리오

1. **문서 전파**: 시책 문서 선택 → 연관된 수수료 문서 조회
2. **유니크 검증**: 동일 경로 중복 등록 시 경고
3. **상품 개편**: 신규 상품에 supersedes 관계 설정
4. **자동 분류**: 파일명에서 보험사/상품/문서유형 자동 추출

## 기술 스택

- **Frontend**: Vue 3 (CDN), Tailwind CSS
- **그래프**: vis-network
- **데이터**: localStorage + JSON
- **테스트**: Playwright

## 디렉토리 구조

```
KMS/
├── src/                     # Python 소스
│   ├── taxonomy.py          # 마스터 데이터 정의
│   ├── ontology.py          # 온톨로지 클래스/관계
│   ├── simulator.py         # 데이터 시뮬레이터
│   ├── simulator_ontology.py # 온톨로지 그래프 생성
│   ├── simulator_golden.py  # Golden Set 검증
│   ├── verifier.py          # 데이터 검증기
│   ├── ontology_validator.py # 온톨로지 검증기
│   ├── rag_simulator.py     # RAG 시뮬레이터
│   ├── warehouse_api.py     # Warehouse API
│   ├── golden_set.py        # Golden Set 정의
│   └── doc_templates.py     # 문서 템플릿
├── data/                    # 생성 데이터
│   ├── taxonomy.json
│   ├── knowledge-graph.json
│   ├── knowledge-graph-ontology.json
│   └── samples/             # 샘플 보험 문서 (260개)
├── ui/                      # 프론트엔드
│   ├── admin.html
│   └── viewer.html
├── tests/                   # 테스트
│   └── scenarios.js
└── docs/                    # 문서
    ├── core/
    ├── architecture/
    ├── results/             # 검증 결과
    └── changelog.md
```

## 라이선스

Private - Internal Use Only
