# KMS v2.1 Handoff Document

> 작성일: 2026-02-05
> 최종 리뷰: 2026-02-06
> 버전: v2.1 + Ontology

---

## 프로젝트 개요

**KMS (Knowledge Management System)** - GA(법인보험대리점)의 비정형 문서를 도메인별로 분류하고 RAG 구현을 위한 지식 그래프 구축 시스템

### 목표
- **"창고지기(Warehouse)"** 역할: 질문에 가장 연관 높은 문서 세트(Anchor + Context)를 기계적으로 추출하여 API로 제공
- **외부 "요리사(Chef)"** 역할: 사용자 의도 분석 → 검색 옵션 요청 → 데이터 재가공 → 최종 답변 생성
- 온톨로지 기반 6-Layer 클래스 계층으로 도메인 전체를 체계화
- 설계→시뮬레이션→검증 사이클로 점진적 도메인 확장

### 프로젝트 단계

| 단계 | 목표 | 상태 |
|------|------|------|
| **Phase A** | 분류체계 + 온톨로지 검증 (JSON 시뮬레이션) | 진행중 ✅ 온톨로지 16/16 통과 |
| **Phase B** | 벡터DB + Scope 필터 + REST API | 예정 |
| **Phase C** | Neo4j + LLM 연동 + 외부 업체 API 공개 | 예정 |

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
| 3-axis → 6-Facet 확장 | ✅ 완료 | `taxonomy_v2_extended.py` |
| Taxonomy JSON 내보내기 | ✅ 완료 | `taxonomy_v2.1.json` |
| 샘플 데이터 생성 (602개 문서) | ✅ 완료 | `simulator_v2_extended.py` |
| 데이터 검증 (3,963항목 통과) | ✅ 완료 | `verify_v2_extended.py` |
| Admin UI v2.1 | ✅ 완료 | `kms-admin-v2.html` |
| RAG 시뮬레이터 edge 버그 수정 | ✅ 완료 | `rag_simulator.py` |

### Phase A-2: 온톨로지 확장

| 작업 | 상태 | 파일 |
|------|------|------|
| 6-Layer 온톨로지 클래스 계층 | ✅ 완료 | `taxonomy_ontology.py` |
| 동의어 시소러스 (60+ 매핑) | ✅ 완료 | `taxonomy_ontology.py` SYNONYM_MAP |
| 개념 노드 (25개 보험 개념) | ✅ 완료 | `taxonomy_ontology.py` CONCEPTS |
| 온톨로지 지식그래프 생성기 | ✅ 완료 | `simulator_ontology.py` |
| 온톨로지 검증 (16/16 통과) | ✅ 완료 | `ontology_validator.py` |
| 전략 정렬 분석서 | ✅ 완료 | `docs/architecture/strategy-alignment.md` |

### 생성된 데이터

```
v2.1 + Ontology 통계
├── 보험사: 17개 (생보 9, 손보 8)
├── 상품: 21개 (4개 카테고리)
├── 문서유형: 41개 (HOT 9, WARM 15, COLD 17)
├── 프로세스: 12개 (7단계 판매 체인 + 5개 지원 프로세스)
├── 역할: 10개
├── 자격증: 7개
├── 규제: 5개 (2024~2029)
├── 개념: 25개 (보험료/수수료/심사/컴플라이언스)
├── 문서: 602개
├── 노드: 669개 (v2.1 대비 +37)
├── 엣지: 1,928개 (v2.1 대비 +703)
│   ├── SIBLINGS: 72
│   ├── REFERENCES: 504
│   ├── USED_IN: 638 (문서→프로세스)
│   ├── PRECEDES: 7 (프로세스 순서)
│   ├── GOVERNS/RESTRICTS: 4 (규제 영향)
│   ├── BROADER/NARROWER/EXPLAINS: 42 (개념 관계)
│   └── 기타 (PARENT, SUPERSEDES 등): 661
└── 온톨로지 클래스: 150+ (6-Layer)

검증 결과: 16/16 통과, 평균 점수 98%
```

---

## 파일 구조

### 현행 파일 (v2.1 + Ontology)

```
KMS/
├── CLAUDE.md                    # AI 작업 가이드 (프로젝트 규칙)
├── HANDOFF.md                   # 이 문서
├── README.md                    # 프로젝트 소개 (v1 기준, 업데이트 필요)
├── WORK_INSTRUCTIONS.md         # v2.1 작업 지시서
│
├── [분류체계]
├── taxonomy_v2_extended.py      # ★ v2.1 분류체계 (6-Facet)
├── taxonomy_ontology.py         # ★ 온톨로지 확장 (클래스 계층, 동의어, 개념)
├── taxonomy_v2.1.json           # ★ v2.1 JSON 내보내기
│
├── [데이터 생성/검증]
├── simulator_v2_extended.py     # ★ v2.1 샘플 생성기
├── simulator_ontology.py        # ★ 온톨로지 지식그래프 생성기 (669노드, 1928엣지)
├── verify_v2_extended.py        # ★ v2.1 검증기
├── rag_simulator.py             # ★ RAG 시뮬레이션 (edge 버그 수정 완료)
├── ontology_validator.py        # ★ 온톨로지 검증 시뮬레이터 (16/16 통과)
│
├── [데이터]
├── knowledge_graph_v2.1.json    # ★ v2.1 지식 그래프 (632노드, 1225엣지)
├── knowledge_graph_ontology.json # ★ 온톨로지 그래프 (669노드, 1928엣지)
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
    │   ├── document-pipeline.md         # 문서 파이프라인
    │   ├── ontology-design.md           # 온톨로지 설계서 (8-도메인 확장 로드맵)
    │   └── strategy-alignment.md        # 컨설팅 전략 ↔ 프로젝트 정렬 분석
    ├── TAXONOMY_V2_CHANGELOG.md         # v1→v2.0→v2.1 변경 내역
    ├── rag_simulation_results.json      # RAG 시뮬레이션 결과 (v2.1)
    ├── ontology_validation_results.json # 온톨로지 검증 결과 (16/16)
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

### 4. RAG 시뮬레이션 (v2.1 기본)
```bash
python3 rag_simulator.py
```

### 5. 온톨로지 지식그래프 생성
```bash
python3 simulator_ontology.py
# 출력: knowledge_graph_ontology.json (669노드, 1928엣지)
```

### 6. 온톨로지 검증 시뮬레이션
```bash
python3 ontology_validator.py
# 기대 결과: 16/16 통과, 평균 점수 98%
# 출력: docs/ontology_validation_results.json
```

### 7. Admin UI 실행
```bash
npx serve . -p 8080
# http://localhost:8080/kms-admin-v2.html 접속
```

---

## 해결된 문제점

### 1. [치명→해결] RAG 시뮬레이터 edge 필드명 불일치

- `rag_simulator.py`: `edge.get('relationship', '')` → `edge.get('type', '')` 수정 완료
- 1,225개 edge 정상 파싱 확인

### 2. [중요→해결] RAG 검색 매칭률 낮음

- **Before**: 평균 27.1% (edge 전파 0%, 동의어 미지원)
- **After**: 온톨로지 검증 16/16 통과, 평균 98% (동의어 60+, 개념 25개, 프로세스 연결 638개)

---

## 남은 과제 (컨설팅 전략 기준)

### 컨설팅 "창고지기" 파이프라인 대비 현황

```
Step 1: 앵커(D0) 확보     [15%] 키워드+동의어만, 벡터 미구현
Step 2: 그래프 확장(D1)    [90%] 9종 관계, 전파 검증 완료
Step 3: Scope 필터링       [ 0%] 설계 완료(strategy-alignment.md), 구현 필요
배송: JSON Payload         [30%] 내부 구조만, anchor/context 분리 필요
배송: REST API             [ 0%] Phase B
```

### P1 - 즉시 (Phase A 마무리)

| 작업 | 설명 | 산출물 |
|------|------|--------|
| Scope 필터 엔진 | regulatory/sales/uw/settlement/training 5종 | `scope_filter.py` |
| JSON Payload 변환기 | 내부 SearchResult → 컨설팅 형식 변환 | `payload_formatter.py` |
| Hub 노드 차단 | 연결 수 >50 노드 전파 제외 | `ontology_validator.py` 업데이트 |

### P2 - 단기 (Phase B 준비)

| 작업 | 설명 | 산출물 |
|------|------|--------|
| 벡터 임베딩 파이프라인 | Qdrant + 문서 임베딩 | `embedding_pipeline.py` |
| search_default API 스펙 | OpenAPI 스펙 작성 | `docs/api/search-api.yaml` |
| Vue 앱 기본 구조 | Vite + Vue 3 + Pinia | `src/` 디렉토리 |
| README.md 업데이트 | v2.1+온톨로지 현행 상태 반영 | `README.md` |

### P3 - 중기 (Phase B + 컨설팅 Phase 1)

| 작업 | 설명 | 산출물 |
|------|------|--------|
| search_default API 오픈 | 벡터 Top-K + 1촌 전체 반환 | REST API |
| scope 파라미터 API | 엣지 유형별 필터링 적용 | REST API |
| 정합성 검증 | Hub 차단, Depth 제한, scope 필터 튜닝 | 검증 리포트 |

### P4 - 장기 (Phase C + 컨설팅 Phase 2~3)

| 작업 | 설명 |
|------|------|
| Neo4j 마이그레이션 | JSON 시뮬레이션 → 그래프 DB |
| 외부 업체 API 공개 | scope/depth 파라미터 + JSON Payload |
| RAG 답변 품질 피드백 루프 | 외부 업체 리포팅 → 관계 유형 튜닝 |

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
| 온톨로지 설계 | `docs/architecture/ontology-design.md` | 6-Layer 온톨로지, 8-도메인 확장 로드맵 |
| **전략 정렬** | `docs/architecture/strategy-alignment.md` | **컨설팅 R&R 전략 ↔ 프로젝트 갭 분석** |
| 변경 내역 | `docs/TAXONOMY_V2_CHANGELOG.md` | v1→v2.0→v2.1 변경사항 |
| 작업 지시서 | `WORK_INSTRUCTIONS.md` | v2.1 상세 작업 분해 |

---

## 연락처

- **Repository**: https://github.com/eyjs/KMS
- **작성자**: JUN (eyjs)
