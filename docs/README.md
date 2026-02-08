# KMS 문서관리 프레임워크 - 문서 인덱스

> **Version** 3.0 | 2026-02-08

---

## 폴더 구조

```
docs/
├── README.md                 # 이 파일
├── changelog.md              # 버전별 변경 내역
│
├── phase1/                   # Phase 1: 분류체계 검증 (현재)
│   ├── README.md                 # Phase 1 개요 및 완료 기준
│   ├── ontology-design.md        # 온톨로지 설계
│   └── results/                  # 검증 결과
│
├── phase2/                   # Phase 2: 백엔드 구축 (예정)
│   ├── README.md                 # Phase 2 개요 및 기술 스택
│   └── document-pipeline.md      # 문서 파이프라인 설계
│
├── phase3/                   # Phase 3: RAG 시스템 (미래)
│   └── README.md                 # Phase 3 개요 및 아키텍처
│
├── design/                   # 상세 설계 문서
│   ├── database-design.md        # 데이터베이스 설계
│   ├── knowledge-architecture.md # 지식 아키텍처
│   ├── use-cases.md              # 유즈케이스
│   └── kms-full-spec-for-notebooklm.md  # 전체 스펙 (NotebookLM용)
│
└── shared/                   # 공유 문서
    ├── framework-overview.md     # 프레임워크 v3.0 전체 개요 (기술)
    ├── framework-guide.md        # 사용 매뉴얼 (비기술자용)
    ├── domain-knowledge.md       # GA 산업 도메인 지식
    └── AI_Knowledge_Architecture_Strategy.pdf  # 아키텍처 전략 (PDF)
```

---

## 빠른 시작

### 프로젝트 이해하기

1. **프레임워크 개요**: `shared/framework-overview.md`
   - 시스템(불변) vs 도메인(가변) 분리 구조
   - 6단계 라이프사이클, 신선도, SSOT 규칙

2. **현재 단계**: `phase1/README.md`
   - JSON 기반 분류체계 검증
   - Admin HTML 페이지로 시뮬레이션

3. **도메인 지식**: `shared/domain-knowledge.md`
   - GA 보험영업 산업 지식
   - 첫 번째 도메인으로 검증 중

---

## Phase별 상태

| Phase | 목표 | 상태 | 문서 |
|-------|------|------|------|
| **Phase 1** | 분류체계 검증 | 현재 진행 | `phase1/` |
| **Phase 2** | 백엔드 구축 | 예정 | `phase2/` |
| **Phase 3** | RAG 시스템 | 미래 | `phase3/` |

---

## 주요 문서 목록

### 필수 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 프레임워크 개요 | `shared/framework-overview.md` | v3.0 핵심 개념 |
| Phase 1 개요 | `phase1/README.md` | 현재 단계 상세 |
| 변경 내역 | `changelog.md` | v1.0 → v2.0 → v3.0 |

### 설계 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 온톨로지 설계 | `phase1/ontology-design.md` | 클래스 계층, 관계 |
| 문서 파이프라인 | `phase2/document-pipeline.md` | 수집/처리/활성화 |
| RAG 아키텍처 | `phase3/README.md` | 검색 증강 생성 |

### 도메인 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| GA 도메인 지식 | `shared/domain-knowledge.md` | 보험 GA 산업 지식 |

---

## 버전 히스토리

| 버전 | 날짜 | 핵심 변경 |
|------|------|----------|
| v3.0 | 2026-02-08 | 프레임워크 전환 (시스템/도메인 분리) |
| v2.0 | 2026-02-05 | 6-Facet 확장 |
| v1.0 | 2026-02 | 초기 버전 |

---

## 관련 파일

- `/CLAUDE.md` - 프로젝트 규칙 (코딩 컨벤션, 명령어)
- `/src/taxonomy.py` - 마스터 데이터 정의
- `/src/ontology.py` - 온톨로지 메타데이터
- `/ui/admin-v3.html` - Admin 페이지
