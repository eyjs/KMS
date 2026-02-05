# KMS v2.1 Handoff Document

> 작성일: 2026-02-06
> 버전: v2.1
> 작성자: 준비 (AI 비서)

---

## 📋 프로젝트 개요

**KMS (Knowledge Management System)** - GA(법인보험대리점)의 비정형 문서를 도메인별로 분류하고 RAG 구현을 위한 지식 그래프 구축 시스템

### 목표
- AI가 질문에 답변할 때, 관련 문서를 컨텍스트로 함께 검색
- 문서 간 관계를 활용한 전파(propagation) 검색
- 6-Facet 분류 체계로 정교한 문서 분류

---

## ✅ 완료된 작업

### Phase A: 분류 체계 설계 (100%)

| 작업 | 상태 | 파일 |
|------|------|------|
| 3-axis → 6-Facet 확장 | ✅ | `taxonomy_v2_extended.py` |
| Taxonomy JSON 내보내기 | ✅ | `taxonomy_v2.1.json` |
| 샘플 데이터 생성 | ✅ | `simulator_v2_extended.py` |
| 데이터 검증 | ✅ | `verify_v2_extended.py` |
| Admin UI v2.1 | ✅ | `kms-admin-v2.html` |
| RAG 시뮬레이션 | ✅ | `rag_simulator.py` |

### 생성된 데이터

```
📊 v2.1 통계
├── 보험사: 17개 (생보 9, 손보 8)
├── 상품: 21개 (4개 카테고리)
├── 문서유형: 41개 (HOT 9, WARM 15, COLD 17)
├── 프로세스: 11개
├── 역할: 10개
├── 자격증: 7개
├── 규제: 5개 (2024~2029)
├── 문서: 602개
├── 노드: 632개
└── 엣지: 1,225개
```

---

## 📁 파일 구조

```
KMS/
├── CLAUDE.md                    # AI 작업 가이드
├── HANDOFF.md                   # (이 문서)
├── README.md                    # 프로젝트 소개
├── WORK_INSTRUCTIONS.md         # 작업 분해
│
├── taxonomy_v2.py               # v2.0 분류체계
├── taxonomy_v2_extended.py      # v2.1 분류체계 (도메인 확장)
├── taxonomy_v2.1.json           # v2.1 JSON 내보내기
│
├── simulator_v2.py              # v2.0 샘플 생성기
├── simulator_v2_extended.py     # v2.1 샘플 생성기
│
├── verify_v2.py                 # v2.0 검증기
├── verify_v2_extended.py        # v2.1 검증기
│
├── rag_simulator.py             # RAG 시뮬레이션
│
├── knowledge_graph_v2.json      # v2.0 그래프
├── knowledge_graph_v2.1.json    # v2.1 그래프
│
├── kms-admin.html               # Admin UI v1
├── kms-admin-v2.html            # Admin UI v2.1
│
└── docs/
    ├── TAXONOMY_V2_CHANGELOG.md
    ├── rag_simulation_results.json
    ├── samples_v2/              # v2.0 샘플 문서
    └── samples_v2.1/            # v2.1 샘플 문서 (602개)
```

---

## 🔧 실행 방법

### 1. 분류체계 확인
```bash
python3 taxonomy_v2_extended.py
```

### 2. 샘플 데이터 재생성
```bash
python3 simulator_v2_extended.py
```

### 3. 데이터 검증
```bash
python3 verify_v2_extended.py
```

### 4. RAG 시뮬레이션
```bash
python3 rag_simulator.py
```

### 5. Admin UI 실행
```bash
open kms-admin-v2.html
```

---

## ⚠️ 발견된 문제점

### 1. RAG 검색 매칭률 낮음 (27.1%)

| 시나리오 | 매칭률 | 원인 |
|----------|--------|------|
| 수수료 질문 | 75% ✅ | 문서명 직접 매칭 |
| 상품 비교 | 0% ❌ | "비교" 키워드 미인식 |
| 심사 문의 | 33% ⚠️ | 질병별/직업별 기준 누락 |
| 규제 문의 | 0% ❌ | COMMON 문서 검색 안됨 |

### 2. 관계 전파 0건
- `simulator_v2_extended.py`에서 edge 생성 시 관계 데이터가 누락됨
- `knowledge_graph_v2.1.json`의 edges에 SIBLINGS/REFERENCES 존재하나 RAG에서 못 읽음

### 3. COMMON 문서 우선순위 낮음
- 법률/규정 문서(DOC-LAW-*, DOC-REGULATION)가 COMMON 카테고리에 있어 검색 우선순위 낮음

---

## 📈 개선 계획

### 단기 (1주)

| 작업 | 우선순위 | 예상 공수 |
|------|----------|----------|
| 문서유형 키워드 확장 | P1 | 2h |
| COMMON 문서 가중치 조정 | P1 | 1h |
| edge 관계 파싱 버그 수정 | P1 | 2h |
| RAG 시뮬레이터 검색 로직 개선 | P2 | 4h |

### 중기 (1개월)

| 작업 | 설명 |
|------|------|
| 실제 문서 업로드 테스트 | 보험사 실제 문서로 분류 정확도 검증 |
| 벡터 임베딩 연동 | OpenAI/Cohere 임베딩으로 시맨틱 검색 |
| Neo4j 그래프DB 마이그레이션 | JSON → Neo4j로 확장성 확보 |

### 장기 (3개월)

| 작업 | 설명 |
|------|------|
| RAG 파이프라인 구축 | LangChain/LlamaIndex 통합 |
| 자동 분류 모델 학습 | 문서명/내용 → 6-Facet 자동 태깅 |
| 실시간 문서 동기화 | 보험사 포털 → KMS 자동 수집 |

---

## 🔑 핵심 개념

### 6-Facet 분류 체계

| Facet | ID 접두사 | 예시 |
|-------|----------|------|
| WHO (보험사) | INS- | INS-SAMSUNG, INS-HANWHA |
| WHAT (상품) | PRD- | PRD-LIFE-WHOLE, PRD-CHILD |
| WHICH (문서유형) | DOC- | DOC-GUIDE, DOC-INCENTIVE |
| Process (프로세스) | BIZ- | BIZ-CONSULT, BIZ-UW |
| Audience (대상) | AUD- | AUD-AGENT, AUD-MANAGER |
| Validity (유효성) | HOT/WARM/COLD | 갱신 주기별 티어 |

### Hot/Warm/Cold 티어

| 티어 | 갱신 주기 | 예시 문서 |
|------|----------|----------|
| HOT | Daily | 시책, 수수료, 보험료표 |
| WARM | Weekly | 상품설명서, 스크립트 |
| COLD | Quarterly | 약관, 법률, 심사기준 |

### 문서 관계

| 관계 | 방향 | 설명 |
|------|------|------|
| SIBLINGS | 양방향 | 동일 레벨 문서 (시책↔수수료) |
| REFERENCES | 단방향 | 참조 (스크립트→설명서) |
| PARENT_OF | 단방향 | 상위 문서 (보통약관→특별약관) |

---

## 📞 연락처

- **Repository**: https://github.com/eyjs/KMS
- **작성자**: JUN (eyjs)

---

*이 문서는 AI 비서 '준비'가 작성했습니다.*
