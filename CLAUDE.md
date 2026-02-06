# KMS 문서관리 프레임워크 v3.0

## 프로젝트 목표

**도메인 무관한 문서관리 프레임워크 구축**

시스템 프레임워크(불변 규칙)와 도메인 설정(가변)을 분리하여,
GA 보험영업을 첫 번째 도메인으로 검증한 뒤 다른 사업(메디코드 등)에도 확장 가능한 구조.
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
| 프레임워크 | Vue 3 CDN | 단일 HTML 파일용 |
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
├── src/                             # Python 소스 (Phase 1만)
│   ├── taxonomy.py                  # 마스터 데이터 정의
│   ├── ontology.py                  # 온톨로지 메타데이터
│   ├── doc_templates.py             # 문서 템플릿
│   ├── simulator.py                 # 데이터 시뮬레이터
│   ├── simulator_ontology.py        # 온톨로지 그래프 생성
│   ├── verifier.py                  # 데이터 무결성 검증
│   └── ontology_validator.py        # 온톨로지 구조 검증
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
    │   └── ontology-validation.json # 구조 검증 6/6
    └── changelog.md                 # 변경 이력
```

## 프레임워크 구조 (v3.0)

### 시스템 vs 도메인 분리

```
┌─────────────────────────────────────────────────────────┐
│                  SYSTEM FRAMEWORK (불변)                  │
│  채번 │ 라이프사이클 │ 신선도 │ 관계 │ SSOT │ 버전      │
├─────────────────────────────────────────────────────────┤
│  Domain A (GA영업)  │  Domain B (메디코드)  │  ...      │
│  carrier, product,  │  service, stage,      │           │
│  docType            │  docType              │           │
└─────────────────────────────────────────────────────────┘
```

### 시스템이 강제하는 것
- 모든 문서에 고유 ID (채번)
- 라이프사이클 상태 머신 (DRAFT → REVIEW → ACTIVE → STALE → DEPRECATED → ARCHIVED)
- 신선도 자동 계산 (HOT: 30일, WARM: 90일, COLD: 365일)
- 관계 타입 제한 (PARENT_OF, CHILD_OF, SIBLING, REFERENCE, SUPERSEDES)
- SSOT: 동일 분류 경로에 ACTIVE 문서 1개만 허용
- 버전: Major.Minor 규칙

### 시스템이 강제하지 않는 것
- 분류 축(facet) 구성: 도메인마다 다름
- 분류 값 (보험사 목록, 상품 목록 등)
- 문서 본문 형식
- 내부 관계 구조

### 도메인 코드

`{BIZ}-{FUNC}` 형식 (예: GA-SALES, GA-COMM, MEDI-SVC, COMMON-COMP)

| 도메인 | facets (SSOT 키) | 설명 |
|--------|-----------------|------|
| GA-SALES | carrier × product × docType | 보험사별 상품별 영업 문서 |
| GA-COMM | carrier × product × docType | 수수료/정산 문서 |
| GA-CONTRACT | carrier × product × docType | 계약관리 문서 |
| GA-COMP | carrier × docType | 컴플라이언스 (상품 무관) |
| GA-EDU | docType | 교육/역량 (보험사/상품 무관) |
| COMMON-COMP | docType | 전사 공통 규제/법률 |

### 라이프사이클 상태 머신

```
DRAFT ──► REVIEW ──► ACTIVE ──► STALE ──► DEPRECATED ──► ARCHIVED
            │                     ▲          │
            └── REJECTED          │          └── (수동 복원 가능)
                            (신선도 만료 시 자동)
```

### 신선도 (Freshness)

```
경과일 = 현재일 - max(updatedAt, reviewedAt)
FRESH:   경과일 < maxAgeDays × 0.7
WARNING: 경과일 < maxAgeDays
EXPIRED: 경과일 ≥ maxAgeDays → 자동 STALE 전환
```

### 문서 데이터 모델 (v3)

```javascript
{
  // 시스템 필드 (불변)
  id: string,                       // 채번된 고유 ID
  domain: string,                   // GA-SALES, GA-COMM, ...
  lifecycle: string,                // DRAFT | REVIEW | ACTIVE | ...
  version: { major: 1, minor: 0 },
  createdAt, updatedAt, reviewedAt,

  // 도메인 필드 (가변)
  classification: {                 // facet 값
    carrier: "INS-SAMSUNG",
    product: "PRD-LIFE-WHOLE",
    docType: "DOC-TERMS",
  },
  meta: {                           // 선택적 메타
    process: "BIZ-CONSULT",
    audience: "AUD-AGENT",
  },

  // 관계
  relations: { parent, children, siblings, references, supersedes, supersededBy },
  name, content, tier,
}
```

### 3-Axis Taxonomy (GA 도메인)

- **WHO**: 보험사 (Carrier) - `INS-SAMSUNG`, `INS-HANWHA`, `INS-KYOBO`
- **WHAT**: 상품군 (Product) - `PRD-LIFE-WHOLE`, `PRD-CHILD`
- **WHICH**: 문서유형 (DocType) - `DOC-TERMS`, `DOC-GUIDE`, `DOC-SCRIPT`, `DOC-INCENTIVE`, `DOC-COMMISSION`, `DOC-TRAINING`

### Hot-Warm-Cold 티어

| Tier | 문서유형 | 변경빈도 | 기본 maxAge |
|------|----------|----------|-------------|
| HOT | 시책, 수수료 | 수시 | 30일 |
| WARM | 상품설명서, 스크립트 | 분기 | 90일 |
| COLD | 약관, 교육자료 | 연간 | 365일 |

### 관계 유형

| 관계 | 설명 | 양방향 | 크로스 도메인 |
|------|------|--------|--------------|
| PARENT_OF / CHILD_OF | 부모-자식 | O | X |
| SIBLING | 형제 | O | X |
| REFERENCE | 참조 | X | O |
| SUPERSEDES | 버전 대체 | X | X |

### SSOT (Single Source of Truth)

**유니크 키**: `도메인 + 분류 경로 내 ACTIVE 상태 문서 1개`

```
[유효 - 모두 유니크]
GA-SALES: KB손해보험 > 든든 어린이보험 > 상품요약본 (ACTIVE)
GA-SALES: KB손해보험 > 든든 어린이보험 > 판매강의자료 (ACTIVE)
GA-SALES: KB손해보험 > 든든 어린이보험 리뉴얼(2026-02) > 상품요약본 (ACTIVE)

[SSOT 위반]
GA-SALES: KB손해보험 > 든든 어린이보험 > 상품요약본 (ACTIVE) ← 이미 존재
→ 새 문서를 ACTIVE로 전환하면 기존 문서 자동 DEPRECATED
```

### 자동 분류 규칙

**파일명 파싱 우선순위:**

1. **보험사 매칭**: 파일명에서 보험사 코드/별칭 검색
   - "KB손해", "KB", "케이비" → KB손해보험
2. **상품 매칭**: 기존 등록 상품명과 유사도 비교
3. **문서유형 매칭**: 키워드 기반 ("요약" → 상품요약본, "스크립트" → 판매스크립트)
4. **날짜/버전 추출**: 정규식 ("202602" → 2026년 2월, "v2" → 버전 2.0)

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
python src/taxonomy.py              # 분류체계 JSON 내보내기
python src/simulator.py             # 지식 그래프 + 샘플 문서 생성
python src/simulator_ontology.py    # 온톨로지 그래프 생성

# 검증
python src/verifier.py              # 데이터 무결성 검증
python src/ontology_validator.py    # 온톨로지 구조 검증

# UI 확인
npx serve . -p 8080
# http://localhost:8080/ui/admin.html
# http://localhost:8080/ui/viewer.html
```

## 새 도메인 추가 방법

1. `src/taxonomy.py`의 `BUSINESSES`에 사업 등록
2. `DOMAINS`에 도메인 정의 (facets, optionalMeta, freshnessOverrides, ssotKey)
3. `DOC_TYPE_DOMAIN_MAP`에 문서유형→도메인 매핑 추가
4. `src/simulator.py`에서 해당 도메인 문서 생성 로직 추가
5. `ui/admin.html`의 DEFAULT_DATA에 도메인 정보 반영

## 참고 문서

- `docs/core/project-goal.md` - 프로젝트 목표 및 단계별 계획
- `docs/core/domain-knowledge.md` - GA 산업 도메인 지식
- `docs/architecture/architecture-guide.md` - 전체 아키텍처
- `docs/architecture/document-pipeline.md` - 문서 파이프라인
- `docs/framework-guide.md` - 문서관리 프레임워크 기획서+매뉴얼 (비기술)

## 주의사항

1. **Vue 필수**: 프론트엔드는 반드시 Vue 사용 (회사 정책)
2. **Phase 1 집중**: 현재는 JSON 기반 검증에만 집중
3. **과설계 금지**: 동작하는 코드 우선, 설계는 최소화
4. **도메인 용어**: 보험 업계 용어 정확히 사용
5. **프레임워크 vs 도메인**: 시스템 규칙은 모든 도메인 공통, 도메인 내부 체계는 해당 전문가가 결정
