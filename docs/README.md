# KMS 문서관리 프레임워크 - 문서 인덱스

> **Version** 3.1 | 2026-02-08

---

## 프로젝트 방향

**문서 체계 관리 시스템 구축**

- 문서 저장, 분류, 관계 관리에 집중
- 문서 처리(파싱, NLP)는 외주에 위임
- 데이터 주권 확보, 확장 가능하게 설계

---

## 폴더 구조

```
docs/
├── README.md                 # 이 파일
├── changelog.md              # 버전별 변경 내역
│
├── phase1/                   # Phase 1: 분류체계 검증 (완료)
│   ├── README.md
│   ├── framework-spec.md
│   └── results/
│
├── phase2/                   # Phase 2: 체계 관리 시스템 (현재)
│   └── README.md                 # 목표, 스택, API, DB 설계
│
├── phase3/                   # Phase 3: 데이터 처리 확장 (선택적)
│   └── README.md                 # 조건부 확장 계획
│
├── architecture/             # 아키텍처 문서
│   └── tech-stack-decision.md    # Python vs .NET 비교 (외주 결정 근거)
│
├── reports/                  # 주체별 보고서 (NEW)
│   ├── README.md
│   ├── report-executive.md       # 임원용 (결정권자)
│   ├── report-field-user.md      # 현업용 (문서 담당자)
│   └── report-developer.md       # 개발자용 (IT팀/운영)
│
├── problems/                 # 프로젝트 분석
│   ├── README.md
│   ├── ideal-approach.md         # 정론 (이상적 방안, 참고용)
│   ├── final-design.md           # 최종 설계 (현실적 방안)
│   └── implementation-strategy.md # 구현 전략 (Option A vs B)
│
└── shared/                   # 공유 문서
    ├── framework-guide.md        # 사용자 가이드 (비기술)
    ├── domain-knowledge.md       # GA 산업 도메인 지식
    └── AI_Knowledge_Architecture_Strategy.pdf
```

---

## Phase별 상태

| Phase | 목표 | 상태 | 문서 |
|-------|------|------|------|
| **Phase 1** | 분류체계 검증 | **완료** | `phase1/` |
| **Phase 2** | 체계 관리 시스템 | **구현 완료** | `phase2/` |
| **Phase 3** | 데이터 처리 확장 | 선택적 | `phase3/` |

---

## 핵심 결정 사항

### 구현 방식
- **Option A 채택**: 체계 관리형 (문서 처리는 외주)
- 성공 확률 70%, 개발 기간 3개월

### 기술 스택
| 영역 | 기술 |
|------|------|
| Frontend | Vue 3 + Element Plus |
| Backend | NestJS 10.x |
| Database | PostgreSQL 16 |
| 뷰어 | pdf.js, marked.js |

### 허용 파일 형식
- **허용**: PDF, Markdown, CSV
- **차단**: Word, PPT, Excel

---

## 빠른 시작

### 주체별 보고서 (권장)
| 대상 | 문서 |
|------|------|
| 임원/결정권자 | `reports/report-executive.md` |
| 현업 담당자 | `reports/report-field-user.md` |
| IT팀/개발자 | `reports/report-developer.md` |

### 현재 단계 이해
1. **Phase 2 개요**: `phase2/README.md`
2. **기술 스택 결정 근거**: `architecture/tech-stack-decision.md`
3. **최종 설계**: `problems/final-design.md`

### 프로젝트 분석
1. **정론 vs 현실**: `problems/ideal-approach.md`, `problems/final-design.md`
2. **구현 전략**: `problems/implementation-strategy.md`

---

## 주요 문서

### 주체별 보고서

| 문서 | 경로 | 설명 |
|------|------|------|
| 임원 보고서 | `reports/report-executive.md` | 투자 결정, 전략 승인 |
| 현업 가이드 | `reports/report-field-user.md` | 시스템 사용법 |
| 개발자 가이드 | `reports/report-developer.md` | 아키텍처, 운영 |

### 필수 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| Phase 2 개요 | `phase2/README.md` | 현재 단계 상세 |
| 최종 설계 | `problems/final-design.md` | 현실적 구현 방안 |
| 기술 스택 | `architecture/tech-stack-decision.md` | 외주 결정 근거 |

### 분석 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 정론 | `problems/ideal-approach.md` | 이상적 방안 |
| 최종 설계 | `problems/final-design.md` | 현실적 방안 |
| 구현 전략 | `problems/implementation-strategy.md` | Option A vs B |

---

## 관련 파일

- `/CLAUDE.md` - 프로젝트 규칙
- `/scripts/` - Phase 1 Python 검증 도구
- `/legacy/` - Phase 1 아카이브 (HTML UI + 데이터)
- `/packages/` - Phase 2 소스 (api, web, shared)

---

**문서 끝**
