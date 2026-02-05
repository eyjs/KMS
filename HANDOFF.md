# KMS v2.1 Handoff Document

> 작성일: 2026-02-05
> 최종 리뷰: 2026-02-05
> 버전: v2.1

---

## 프로젝트 개요

**KMS (Knowledge Management System)** - GA(법인보험대리점)의 비정형 문서를 도메인별로 분류하고 RAG 구현을 위한 지식 그래프 구축 시스템

### 목표
- AI가 질문에 답변할 때, 관련 문서를 컨텍스트로 함께 검색
- 문서 간 관계를 활용한 전파(propagation) 검색
- 6-Facet 분류 체계로 정교한 문서 분류

### 프로젝트 단계

| 단계 | 목표 | 상태 |
|------|------|------|
| **Phase A** | 보험상품 도메인으로 분류체계 검증 (Admin 페이지) | 진행중 |
| **Phase B** | 전체 도메인 확장 + Vue 앱 구축 | 예정 |
| **Phase C** | AI RAG 시스템 연동 | 예정 |

---

## 실행 환경

| 요구사항 | 버전 | 용도 |
|----------|------|------|
| Python 3 | 3.8+ | taxonomy, simulator, verifier, RAG 시뮬레이션 |
| Node.js | 16+ | 로컬 서버, 테스트 |
| 브라우저 | Chrome/Edge | Admin UI |

---

## 완료된 작업

### Phase A: 분류 체계 설계

| 작업 | 상태 | 파일 |
|------|------|------|
| 3-axis → 6-Facet 확장 | 완료 | `taxonomy_v2_extended.py` |
| Taxonomy JSON 내보내기 | 완료 | `taxonomy_v2.1.json` |
| 샘플 데이터 생성 (602개 문서) | 완료 | `simulator_v2_extended.py` |
| 데이터 검증 (3,963항목 통과) | 완료 | `verify_v2_extended.py` |
| Admin UI v2.1 | 완료 | `kms-admin-v2.html` |
| RAG 시뮬레이션 | 완료 (버그 있음) | `rag_simulator.py` |

### 생성된 데이터

```
v2.1 통계
├── 보험사: 17개 (생보 9, 손보 8)
├── 상품: 21개 (4개 카테고리)
├── 문서유형: 41개 (HOT 9, WARM 15, COLD 17)
├── 프로세스: 11개
├── 역할: 10개
├── 자격증: 7개
├── 규제: 5개 (2024~2029)
├── 문서: 602개
├── 노드: 632개
└── 엣지: 1,225개 (SIBLINGS 72, REFERENCES 504 등)
```

---

## 파일 구조

### 현행 파일 (v2.1)

```
KMS/
├── CLAUDE.md                    # AI 작업 가이드 (프로젝트 규칙)
├── HANDOFF.md                   # 이 문서
├── README.md                    # 프로젝트 소개 (v1 기준, 업데이트 필요)
├── WORK_INSTRUCTIONS.md         # v2.1 작업 지시서
│
├── [분류체계]
├── taxonomy_v2_extended.py      # ★ v2.1 분류체계 (6-Facet, 현행)
├── taxonomy_v2.1.json           # ★ v2.1 JSON 내보내기
│
├── [데이터 생성/검증]
├── simulator_v2_extended.py     # ★ v2.1 샘플 생성기
├── verify_v2_extended.py        # ★ v2.1 검증기
├── rag_simulator.py             # ★ RAG 시뮬레이션 (버그 있음, 아래 참조)
│
├── [데이터]
├── knowledge_graph_v2.1.json    # ★ v2.1 지식 그래프 (632노드, 1225엣지)
│
├── [Admin UI]
├── kms-admin-v2.html            # ★ Admin UI v2.1 (현행)
├── viewer.html                  # 그래프 뷰어
│
├── [기타]
├── doc_templates.py             # 문서 템플릿
├── test-scenarios.js            # Playwright 테스트
├── package.json                 # NPM 설정
│
└── docs/
    ├── core/
    │   ├── project_goal.md              # 프로젝트 목표 및 단계별 계획
    │   ├── domain_knowledge.md          # GA 산업 도메인 지식 (핵심 참고자료)
    │   └── AI_Knowledge_Architecture_Strategy.pdf  # 전략 문서
    ├── architecture/
    │   ├── architecture-guide.md        # 전체 아키텍처 설계
    │   └── document-pipeline.md         # 문서 파이프라인
    ├── TAXONOMY_V2_CHANGELOG.md         # v1→v2.0→v2.1 변경 내역
    ├── rag_simulation_results.json      # RAG 시뮬레이션 결과
    ├── samples/                         # v1.0 샘플 (36개)
    ├── samples_v2/                      # v2.0 샘플
    └── samples_v2.1/                    # v2.1 샘플 (602개, 9개 보험사)
```

### 레거시 파일 (정리 대상)

아래 파일들은 v1/v2.0 버전의 중간 산출물로, 이력 참고용입니다.
v2.1 파일이 이들을 완전히 대체합니다.

| 파일 | 버전 | 대체 파일 |
|------|------|-----------|
| `taxonomy.py` | v1.0 | `taxonomy_v2_extended.py` |
| `taxonomy_v2.py` | v2.0 | `taxonomy_v2_extended.py` |
| `simulator.py` | v1.0 | `simulator_v2_extended.py` |
| `simulator_v2.py` | v2.0 | `simulator_v2_extended.py` |
| `verify_v2.py` | v2.0 | `verify_v2_extended.py` |
| `knowledge_graph.json` | v1.0 | `knowledge_graph_v2.1.json` |
| `knowledge_graph_v2.json` | v2.0 | `knowledge_graph_v2.1.json` |
| `kms-admin.html` | v1.0 | `kms-admin-v2.html` |
| `docs/samples/` | v1.0 | `docs/samples_v2.1/` |
| `docs/samples_v2/` | v2.0 | `docs/samples_v2.1/` |

---

## 실행 방법

### 1. 분류체계 확인
```bash
python3 taxonomy_v2_extended.py
```

### 2. 샘플 데이터 재생성
```bash
python3 simulator_v2_extended.py
# 출력: knowledge_graph_v2.1.json, docs/samples_v2.1/
```

### 3. 데이터 검증
```bash
python3 verify_v2_extended.py
# 기대 결과: 통과 3,963 / 실패 0 / 경고 0
```

### 4. RAG 시뮬레이션
```bash
python3 rag_simulator.py
# 현재 결과: 평균 27.1% (버그로 인해 전파 미작동)
```

### 5. Admin UI 실행
```bash
npx serve . -p 8080
# http://localhost:8080/kms-admin-v2.html 접속
```

---

## 발견된 문제점

### 1. [치명] RAG 시뮬레이터 edge 필드명 불일치

**증상**: 관계 전파(propagation) 결과가 항상 0건

**근본 원인**: `rag_simulator.py`의 edge 파싱 로직이 잘못된 필드명을 참조

```python
# rag_simulator.py (현재 - 버그)
rel = edge.get('relationship', '')   # 'relationship' 필드를 찾음

# knowledge_graph_v2.1.json (실제 데이터)
{ "source": "...", "target": "...", "type": "SIBLINGS" }  # 'type' 필드를 사용
```

**영향**: 1,225개 edge가 모두 무시됨. 전파 검색 완전 불능.

**수정 방법**: `edge.get('relationship', '')` → `edge.get('type', '')`

> 참고: 기존 HANDOFF.md에는 "simulator에서 edge 생성 시 관계 데이터 누락"이라 기술되어 있었으나,
> 이는 오진단입니다. edge 데이터 자체는 정상 생성되어 있으며 (SIBLINGS 72개, REFERENCES 504개),
> 시뮬레이터의 파싱 코드가 원인입니다.

### 2. [중요] RAG 검색 매칭률 낮음 (27.1%)

| 시나리오 | 매칭률 | 원인 분석 |
|----------|--------|-----------|
| 수수료 질문 | 75% | 문서명에 "수수료" 키워드 직접 포함 → 매칭 성공 |
| 상품 비교 | 0% | "비교" 키워드가 DOC-COMPARISON 문서명과 매칭 안 됨 |
| 심사 문의 | 33% | "심사"로 DOC-UW-GUIDE 매칭, 질병별/직업별 세부 기준 문서 부재 |
| 규제 문의 | 0% | "1200%룰" 키워드 매칭 실패 + COMMON 문서 검색 우선순위 낮음 |

**복합 원인**:
1. edge 파싱 버그로 전파 검색 불능 (위 #1)
2. 키워드 기반 매칭의 한계 (동의어/유의어 미지원)
3. COMMON 카테고리 문서(법률/규제)의 검색 가중치 부족
4. 문서유형별 검색 키워드 사전 불완전

### 3. [보통] COMMON 문서 검색 우선순위 낮음

법률/규정 문서(`DOC-LAW-*`, `DOC-REGULATION`)가 `COMMON` 카테고리에 배치되어
보험사/상품 필터에서 매칭되지 않음. 규제 관련 질의 시 검색 결과에서 누락.

### 4. [보통] README.md v1 기준 미업데이트

README.md가 v1 기준(3개 보험사, 36개 문서, 6개 문서유형)으로 작성되어 있어
현행 v2.1 상태와 불일치.

---

## 개선 계획

### 단기 (P1 - 즉시)

| 작업 | 설명 |
|------|------|
| edge 필드명 버그 수정 | `rag_simulator.py`에서 `'relationship'` → `'type'` 변경 |
| RAG 시뮬레이션 재실행 | 버그 수정 후 매칭률 변화 확인 |
| COMMON 문서 가중치 조정 | 보험사 무관 문서도 기본 검색 결과에 포함 |
| 문서유형 키워드 확장 | "비교" → DOC-COMPARISON 등 동의어 매핑 추가 |

### 단기 (P2 - 1주 내)

| 작업 | 설명 |
|------|------|
| 레거시 파일 정리 | v1/v2.0 중간 파일 삭제 또는 archive 디렉토리로 이동 |
| README.md 업데이트 | v2.1 현행 상태 반영 |
| 검증 스크립트 강화 | edge 필드 형식 검증, RAG 전파 동작 검증 추가 |

### 중기 (1개월)

| 작업 | 설명 |
|------|------|
| 실제 문서 업로드 테스트 | 보험사 실제 문서로 분류 정확도 검증 |
| 벡터 임베딩 연동 | OpenAI/Cohere 임베딩으로 시맨틱 검색 (키워드 한계 극복) |
| Neo4j 그래프DB 마이그레이션 | JSON → Neo4j로 확장성 확보 |

### 장기 (3개월)

| 작업 | 설명 |
|------|------|
| RAG 파이프라인 구축 | LangChain/LlamaIndex 통합 |
| 자동 분류 모델 학습 | 문서명/내용 → 6-Facet 자동 태깅 |
| 실시간 문서 동기화 | 보험사 포털 → KMS 자동 수집 |

---

## 핵심 개념

### 6-Facet 분류 체계

| Facet | ID 접두사 | 예시 | 설명 |
|-------|----------|------|------|
| WHO (보험사) | INS- | INS-SAMSUNG, INS-HANWHA | 17개 보험사 + COMMON |
| WHAT (상품) | PRD- | PRD-LIFE-WHOLE, PRD-CHILD | 21개 상품 (4카테고리) |
| WHICH (문서유형) | DOC- | DOC-GUIDE, DOC-INCENTIVE | 41개 유형 |
| Process (프로세스) | BIZ- | BIZ-CONSULT, BIZ-UW | 11개 업무 프로세스 |
| Audience (대상) | AUD- | AUD-AGENT, AUD-MANAGER | 10개 역할 |
| Validity (유효성) | HOT/WARM/COLD | 갱신 주기별 티어 | 3단계 |

### Hot/Warm/Cold 티어

| 티어 | 갱신 주기 | 예시 문서 |
|------|----------|----------|
| HOT | Daily | 시책, 수수료, 보험료표, 내부공지 |
| WARM | Weekly | 상품설명서, 스크립트, 심사가이드, 비교표, 브로슈어 |
| COLD | Quarterly | 약관, 특약, 심사기준, 면책, 교육, 컴플라이언스 |

### 문서 관계

| 관계 | 방향 | 설명 | 역관계 |
|------|------|------|--------|
| PARENT_OF | 단방향 | 상위 문서 | CHILD_OF |
| CHILD_OF | 단방향 | 하위 문서 | PARENT_OF |
| SIBLINGS | 양방향 | 동일 레벨 문서 (시책↔수수료) | - |
| REFERENCES | 단방향 | 참조 (스크립트→설명서) | REFERENCED_BY |
| SUPERSEDES | 단방향 | 버전 대체 (신→구) | SUPERSEDED_BY |
| REQUIRES | 단방향 | 선행 문서 필요 | REQUIRED_BY |

### 문서 ID 규칙

```
{DOC-TYPE}-{CARRIER}-{PRODUCT}-{SEQ}
예: DOC-COMMISSION-INS-SAMSUNG-PRD-LIFE-WHOLE-001
```

### 유니크 제약

```
유니크 키: 보험사 + 상품 + 문서유형 + 버전

[유효] KB손해보험 > 든든 어린이보험 > 상품요약본 v1.0
[유효] KB손해보험 > 든든 어린이보험 > 판매강의자료 v1.0
[중복] KB손해보험 > 든든 어린이보험 > 상품요약본 v1.0  ← 오류
```

---

## 참고 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 프로젝트 규칙 | `CLAUDE.md` | AI 작업 가이드, 코딩 컨벤션 |
| 프로젝트 목표 | `docs/core/project_goal.md` | Phase A/B/C 로드맵 |
| 도메인 지식 | `docs/core/domain_knowledge.md` | GA 산업 용어, 업무 흐름 |
| 아키텍처 | `docs/architecture/architecture-guide.md` | 전체 시스템 설계 |
| 문서 파이프라인 | `docs/architecture/document-pipeline.md` | 문서 처리 흐름 |
| 변경 내역 | `docs/TAXONOMY_V2_CHANGELOG.md` | v1→v2.0→v2.1 변경사항 |
| 작업 지시서 | `WORK_INSTRUCTIONS.md` | v2.1 상세 작업 분해 |

---

## 연락처

- **Repository**: https://github.com/eyjs/KMS
- **작성자**: JUN (eyjs)
