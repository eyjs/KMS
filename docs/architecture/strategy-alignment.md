# 전략 컨설팅 문서 ↔ 프로젝트 현황 정렬 분석서

> **작성일**: 2026-02-06
> **기준 문서**: 지식관리체계 구축 R&R 및 실행 전략서
> **대비 대상**: KMS 프로젝트 현재 구현 (Phase A + 온톨로지 확장)

---

## 1. 핵심 컨셉 대비

### 1.1 "창고지기(Warehouse) vs 요리사(Chef)" 모델

```
┌─────────────────────────────────────────────────────────────────┐
│                     컨설팅 문서의 목표 구조                       │
│                                                                 │
│  ┌──────────────────────┐     API      ┌──────────────────────┐ │
│  │   우리 (Warehouse)    │ ──────────→ │  외부 (Chef)          │ │
│  │                      │  JSON       │                      │ │
│  │  • 벡터DB 앵커 검색   │  Payload    │  • 의도 분석          │ │
│  │  • 그래프 D1 확장     │             │  • scope/depth 결정   │ │
│  │  • Scope 필터링       │  ←────────  │  • 리랭킹             │ │
│  │  • 추적경로 포함 반환  │  API 호출   │  • LLM 답변 생성      │ │
│  └──────────────────────┘             └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 현재 프로젝트에서 검증 완료된 부분

| 컨설팅 문서 요구사항 | 현재 구현 상태 | 매핑 위치 |
|---------------------|---------------|----------|
| 문서 메타데이터 자동 추출 | ✅ 6-Facet 태깅 체계 | `taxonomy_v2_extended.py` |
| 지식그래프 구축 | ✅ JSON 시뮬레이션 (669노드, 1928엣지) | `knowledge_graph_ontology.json` |
| 문서 간 참조관계(Edge) 정의 | ✅ 9종 관계 타입 검증 완료 | `taxonomy_ontology.py` RELATION_TYPES |
| 앵커(D0) 문서 추출 | ⚠️ 키워드+동의어 기반 (벡터 미구현) | `ontology_validator.py` OntologyRAG.search() |
| 그래프 기반 D1 확장 | ✅ 전파 검색 구현 및 검증 | `ontology_validator.py` _propagate() |
| Scope 파라미터 필터링 | ❌ 미구현 | 설계 필요 |
| JSON Payload 구조 | ⚠️ 내부 검증용 (anchor/context 미분리) | 재구조화 필요 |
| REST API | ❌ 미구현 | Phase B |

---

## 2. 3단계 기계적 파이프라인 갭 분석

### 컨설팅 문서의 파이프라인:

```
Step 1: 앵커(D0) 확보        Step 2: 그래프 확장(D1)      Step 3: Scope 필터링
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ 벡터DB(Qdrant)에서  │     │ D0의 1촌 문서를     │     │ scope 파라미터로    │
│ 질문과 유사도 높은   │ ──→ │ Neo4j에서 가져옴    │ ──→ │ 허용 안 된 엣지     │
│ 상위 K개 문서       │     │ (parent, child,    │     │ 제거               │
│                    │     │  references 등)    │     │                    │
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

### 현재 구현 대비:

| 단계 | 컨설팅 목표 | 현재 구현 | 갭 수준 | 비고 |
|------|-----------|----------|--------|------|
| **Step 1** | Qdrant 벡터 유사도 Top-K | 키워드+동의어 매칭 | 🟡 중간 | 동의어 시소러스(60+)로 키워드 한계 보완 중 |
| **Step 2** | Neo4j 그래프 1촌 탐색 | JSON adj/rev_adj 탐색 | 🟢 낮음 | 동일 로직, 저장소만 다름 |
| **Step 3** | scope 파라미터 필터링 | 미구현 | 🔴 높음 | scope 정의 + 엣지→scope 매핑 필요 |

### Step 1 상세: 앵커 검색

**현재 검색 스코어링 로직** (`ontology_validator.py` OntologyRAG.search):
```
문서명 매칭:          +0.5
동의어 확장 매칭:      +0.6  ← 컨설팅 문서에 없는 우리만의 강점
문서유형명 매칭:       +0.4
보험사 매칭:          +0.3
Tier 가중치(HOT):     +0.2
```

**벡터 검색 전환 시 변경점:**
- 키워드 스코어링 → 코사인 유사도 (0~1)
- 동의어 시소러스 → 임베딩 공간에서 자연 해결 (일부)
- 단, 도메인 특화 동의어("1200%룰", "삼일칠" 등)는 **벡터만으로 부족** → 시소러스 유지 필요

### Step 2 상세: 그래프 확장

**현재 구현된 엣지 유형별 확장 규칙:**

| 엣지 유형 | 전파 방향 | 스코어 감쇄 | 검증 결과 |
|-----------|----------|------------|----------|
| SIBLINGS | 양방향 | score / depth | ✅ 시나리오1,6 통과 |
| REFERENCES | 단방향(→) | score / depth | ✅ 시나리오3 통과 |
| HAS_DOCUMENT | 단방향(↓) | score / depth | ✅ 시나리오2 통과 |
| USED_IN | 역추적(←) | 0.8 고정 | ✅ 시나리오6 통과 |
| GOVERNS/RESTRICTS | 단방향 | 직접 탐색 | ✅ 시나리오4 통과 |
| PRECEDES | 순방향(→) | 체인 탐색 | ✅ 시나리오5 통과 |
| EXPLAINS | 단방향(→) | 0.55 | ✅ 시나리오7 통과 |
| BROADER/NARROWER | 양방향 | 개념 탐색 | ✅ 시나리오7 통과 |

**→ Neo4j 전환 시 Cypher 매핑 준비 완료**

### Step 3 상세: Scope 필터링 (신규 설계 필요)

컨설팅 문서의 scope 개념을 온톨로지에 매핑:

| scope 값 | 허용 엣지 | 제외 엣지 | 사용 시나리오 |
|----------|----------|----------|-------------|
| `regulatory` | GOVERNS, RESTRICTS, REFERENCES(법규) | SIBLINGS(판매), USED_IN(판매프로세스) | "법적으로 문제없어?" |
| `sales_support` | SIBLINGS, REFERENCES, USED_IN(BIZ-CONSULT) | GOVERNS, RESTRICTS | "어떻게 팔아?" |
| `underwriting` | REFERENCES(심사), USED_IN(BIZ-UW) | SIBLINGS(판매), USED_IN(BIZ-SETTLE) | "심사 가능?" |
| `settlement` | SIBLINGS(수수료), GOVERNS, USED_IN(BIZ-SETTLE) | USED_IN(BIZ-CONSULT) | "수수료 얼마?" |
| `training` | EXPLAINS, BROADER/NARROWER | GOVERNS, RESTRICTS | "이게 뭐야?" |
| `default` | ALL (depth 제한만) | 없음 | 일반 질문 |

**→ 이 매핑 테이블이 scope 필터 엔진의 설정값이 됨**

---

## 3. JSON Payload 구조 정렬

### 3.1 컨설팅 문서 목표 구조:

```json
{
  "anchor_documents": [
    {
      "id": "PRD-TRM-LIF-SAM-00001",
      "type": "약관",
      "content": "...",
      "score": 0.92
    }
  ],
  "context_documents": [
    {
      "id": "REF-LAW-INS-GEN-00001",
      "type": "보험업법",
      "content": "...",
      "relation_to_anchor": "regulation",
      "direction": "outgoing"
    }
  ]
}
```

### 3.2 현재 구현 구조:

```json
{
  "node_id": "DOC-COMMISSION-INS-SAMSUNG-PRD-LIFE-WHOLE-001",
  "score": 0.8,
  "reason": "동의어 확장 매칭, 보험사 매칭",
  "propagated_from": null
}
```

### 3.3 전환 매핑:

| 컨설팅 필드 | 현재 필드 | 변환 규칙 |
|------------|----------|----------|
| `anchor_documents[].id` | `node_id` (propagated_from=null) | score 상위 & 직접매칭만 anchor |
| `anchor_documents[].type` | `node.properties.doc_type` → taxonomy name | DOC-COMMISSION → "수수료체계" |
| `anchor_documents[].score` | `score` | 그대로 |
| `anchor_documents[].content` | 미구현 (메타데이터만) | Phase B에서 문서 본문 연결 |
| `context_documents[].relation_to_anchor` | `reason` 파싱 또는 edge.rel_type | "SIBLINGS (depth=1)" → "siblings" |
| `context_documents[].direction` | edge 방향 (adj vs rev_adj) | outgoing/incoming |

### 3.4 변환 구현 예시 (현재 코드 기반):

```python
def to_consulting_format(search_results, graph):
    """현재 SearchResult → 컨설팅 JSON Payload 변환"""
    anchors = []
    contexts = []

    for sr in search_results:
        node = graph.nodes[sr.node_id]
        doc_entry = {
            "id": sr.node_id,
            "type": node.properties.get("doc_type", ""),
            "type_name": resolve_type_name(node.properties.get("doc_type")),
            "carrier": node.properties.get("carrier", ""),
            "score": sr.score,
            "content": "",  # Phase B: 본문 연결
        }

        if sr.propagated_from is None:
            anchors.append(doc_entry)
        else:
            doc_entry["relation_to_anchor"] = extract_relation(sr.reason)
            doc_entry["direction"] = extract_direction(sr.reason)
            doc_entry["anchor_id"] = sr.propagated_from
            contexts.append(doc_entry)

    return {"anchor_documents": anchors, "context_documents": contexts}
```

---

## 4. R&R 기준 현재 달성도

### 4.1 우리(Warehouse) 책임 영역

| 컨설팅 문서 항목 | 달성도 | 현재 상태 | 남은 작업 |
|-----------------|-------|----------|----------|
| 문서 파싱 및 메타데이터 자동 추출 | 🟢 80% | 6-Facet 자동 분류 규칙 정의 완료 | 실제 PDF 파싱 엔진 (Phase B) |
| 지식그래프(Neo4j) 구축 | 🟡 60% | JSON 시뮬레이션 검증 완료 (669노드, 1928엣지) | Neo4j 마이그레이션 (Phase C) |
| 벡터DB(Qdrant) 구축 | 🔴 10% | 동의어 시소러스로 의미 검색 대체 중 | 임베딩 파이프라인 (Phase B) |
| 문서 간 참조관계(Edge) 정의 | 🟢 90% | 9종 관계 타입, 20+ 세부 관계 정의 및 검증 | 실제 문서 관계 매핑 |
| 하이브리드 검색 파이프라인 | 🟡 50% | 키워드+그래프 전파+개념 검색 구현 | 벡터 검색 + scope 필터 추가 |
| JSON Payload 구조 | 🟡 40% | SearchResult 내부 구조 존재 | anchor/context 분리 변환 필요 |
| REST API | 🔴 0% | 없음 | Phase B |

### 4.2 책임 소재 검증 시나리오

| 컨설팅 문서 질문 | 현재 검증 가능 여부 | 해당 테스트 |
|----------------|-------------------|-----------|
| "관련 없는 문서가 포함되었는가?" | ✅ 검증 가능 | 시나리오1~10: 기대 문서유형 vs 실제 반환 비교 |
| "연결된 문서를 누락했는가?" | ✅ 검증 가능 | 시나리오6: 정산 프로세스 4유형 전수 확인 |
| "규제 문서가 빠졌는가?" | ✅ 검증 가능 | 시나리오4: GOVERNS/RESTRICTS 체인 확인 |
| "프로세스 순서가 맞는가?" | ✅ 검증 가능 | 시나리오5: PRECEDES 체인 7단계 검증 |

---

## 5. 외부 업체 가이드 ↔ 온톨로지 매핑

### 5.1 Query Router → 온톨로지 클래스

컨설팅 문서의 "쿼리 라우터" 개념이 온톨로지 클래스와 직접 매핑:

| 질문 의도 | scope | 온톨로지 클래스 탐색 대상 |
|----------|-------|----------------------|
| "법적으로 문제없어?" | `regulatory` | `ga:Regulation`, `ga:ComplianceDocument` |
| "어떻게 팔아?" | `sales_support` | `ga:SalesDocument`, `ga:SalesProcess` |
| "심사 가능?" | `underwriting` | `ga:UWDocument`, `ga:UWProcess` |
| "수수료 얼마?" | `settlement` | `ga:CommissionStructure`, `ga:SettlementProcess` |
| "이게 뭐야?" | `training` | `ga:Concept`, `ga:TrainingDocument` |

**현재 검증 결과:**
- `ga:UWDocument` 계층 검색 → 90개 노드 정확 반환 (시나리오2)
- 규제 영향 범위 → GOVERNS + RESTRICTS 정확 추적 (시나리오4)
- 프로세스별 문서 → USED_IN 역추적 성공 (시나리오6)

### 5.2 리랭킹 힌트 → relation_to_anchor

컨설팅 문서: *"relation_to_anchor 값을 보고, LLM 프롬프트에 맥락을 주입해야 한다"*

현재 엣지 유형별 프롬프트 힌트 매핑:

| edge type | relation_to_anchor | 프롬프트 주입 템플릿 |
|-----------|-------------------|-------------------|
| PARENT_OF | `parent` | "다음은 [앵커 문서]의 상위 문서입니다" |
| CHILD_OF | `child` | "다음은 [앵커 문서]의 하위 세부 문서입니다" |
| SIBLINGS | `sibling` | "다음은 [앵커 문서]와 같은 수준의 관련 문서입니다" |
| REFERENCES | `reference` | "다음은 [앵커 문서]가 참조하는 근거 문서입니다" |
| GOVERNS | `regulation` | "다음은 [앵커 문서]에 적용되는 규제입니다" |
| RESTRICTS | `restriction` | "다음은 [앵커 문서]를 제한하는 규정입니다" |
| EXPLAINS | `explanation` | "다음은 [앵커 문서]의 용어/개념 설명입니다" |
| SUPERSEDES | `previous_version` | "다음은 [앵커 문서]가 대체한 이전 버전입니다" |

---

## 6. 단계별 로드맵 정렬

### 컨설팅 문서 로드맵 vs 프로젝트 현실

```
컨설팅 Phase 1 ("기본 검색" 오픈)
├── 우리: 문서 파싱, 벡터 임베딩, Neo4j 기본 참조관계 적재
├── 우리: search_default API 오픈
└── 외부: 챗봇 UI 개발

  ↕ 매핑

프로젝트 Phase A (현재) + Phase B (예정)
├── ✅ 완료: 문서 메타데이터 체계 (6-Facet + 온톨로지)
├── ✅ 완료: 참조관계 정의 및 검증 (9종, 1928엣지)
├── ✅ 완료: 검색 로직 시뮬레이션 (16/16 통과)
├── ⬜ 필요: 벡터 임베딩 파이프라인
├── ⬜ 필요: Neo4j 마이그레이션
└── ⬜ 필요: REST API 구현
```

### 통합 로드맵 (컨설팅 + 프로젝트 병합)

| 시기 | 컨설팅 Phase | 프로젝트 Phase | 핵심 산출물 |
|------|-------------|--------------|-----------|
| **현재** | - | **A: 검증** | ✅ 온톨로지 정의, 관계 검증, 시뮬레이션 16/16 |
| **+2주** | Phase 1 준비 | **A→B 전환** | scope 필터 구현, JSON Payload 변환기, API 스펙 확정 |
| **+4주** | Phase 1 | **B: 기본 검색** | Vue 앱, Qdrant 벡터DB, search_default API |
| **+6주** | Phase 2 | **B: 옵션형 검색** | scope 파라미터 API, 엣지 유형별 필터링 |
| **+10주** | Phase 3 | **C: 하이브리드** | Neo4j 그래프 DB, 정합성 검증, Hub 노드 차단 |

---

## 7. "철수>영희>길동>뽀삐" 방지 (Depth 제한)

컨설팅 문서 Phase 3에서 언급한 핵심 리스크.

### 현재 구현된 방어 메커니즘:

```python
# ontology_validator.py → _propagate()
def _propagate(self, seed_ids, visited, max_depth=2):
    # 1. Depth 제한: max_depth=2 (기본값)
    if depth > max_depth:
        return

    # 2. 허용 엣지만 전파 (Hub 노드 차단 효과)
    if e.rel_type not in ("SIBLINGS", "REFERENCES", "HAS_DOCUMENT"):
        continue

    # 3. 문서 노드만 수집 (비문서 노드 통과 방지)
    if "Document" not in target_node.labels:
        continue

    # 4. 점수 감쇄 (거리에 반비례)
    score = score_map.get(e.rel_type, 0.5) / depth
```

### 추가 필요 사항:

| 방어책 | 현재 | 컨설팅 요구 | 구현 계획 |
|--------|------|-----------|----------|
| Depth 제한 | ✅ max_depth=2 | Max 2 | 완료 |
| Hub 노드 차단 | ⚠️ 엣지 타입 필터만 | 명시적 Hub 식별 | 연결 수 임계값(>50) 노드 차단 |
| 점수 감쇄 | ✅ score/depth | 거리 반비례 | 완료 |
| scope 필터 | ❌ 미구현 | 엣지 유형 차단 | 다음 단계 |

---

## 8. 컨설팅 문서 대비 우리의 차별화 포인트

현재 프로젝트가 컨설팅 문서의 기대치를 **초과 달성**한 영역:

### 8.1 온톨로지 클래스 계층 (컨설팅 문서에 없음)

```
컨설팅 문서: "Neo4j에 기본 참조관계 적재"
→ 단순 노드-엣지 그래프

현재 구현: 6-Layer 온톨로지 + 클래스 상속
→ ga:UWDocument 검색 시 하위 3개 서브클래스 90개 문서 자동 포함
→ 클래스 기반 scope 필터링 가능
```

### 8.2 개념(Concept) 노드 (컨설팅 문서에 없음)

```
컨설팅 문서: 문서 간 관계만 존재
→ "FYC가 뭐야?" 같은 용어 질문에 대응 불가

현재 구현: 25개 개념 노드 + BROADER/NARROWER/EXPLAINS
→ "보험료 구조" 질문 시 순보험료, 부가보험료 개념 연결
→ 개념 → 관련 문서 EXPLAINS 엣지로 교육/온보딩 지원
```

### 8.3 동의어 시소러스 (컨설팅 문서에서 미상세)

```
컨설팅 문서: "벡터 유사도"에 의존
→ "삼일칠", "1200%룰" 같은 도메인 은어 검색 실패 가능

현재 구현: 60+ 동의어 매핑
→ "비교" → DOC-COMPARISON
→ "1200%룰" → DOC-COMMISSION-CALC, DOC-REGULATION
→ "삼일칠" → DOC-COOLING-OFF, DOC-DISCLOSURE-DUTY
```

### 8.4 프로세스 순서 검증 (컨설팅 문서에 없음)

```
컨설팅 문서: 프로세스 언급 없음
현재 구현: 7단계 판매프로세스 체인 (PRECEDES) + USED_IN 역추적
→ "정산 관련 문서" → BIZ-SETTLE 프로세스에 USED_IN된 문서 4유형 반환
```

---

## 9. 즉시 실행 가능한 다음 단계

### Priority 1: Scope 필터 엔진 구현 (컨설팅 Phase 1 핵심)

```python
# 구현 대상: scope_filter.py
SCOPE_CONFIG = {
    "regulatory": {
        "allow_edges": ["GOVERNS", "RESTRICTS", "REFERENCES"],
        "allow_classes": ["ga:Regulation", "ga:ComplianceDocument"],
        "block_edges": ["SIBLINGS"],
        "max_depth": 1,
    },
    "sales_support": {
        "allow_edges": ["SIBLINGS", "REFERENCES", "USED_IN"],
        "allow_classes": ["ga:SalesDocument", "ga:IncentiveProgram"],
        "block_processes": ["BIZ-UW", "BIZ-CLAIM"],
        "max_depth": 2,
    },
    # ...
}
```

### Priority 2: JSON Payload 변환기 (외부 업체 연동 준비)

```python
# 구현 대상: payload_formatter.py
# SearchResult → 컨설팅 문서 형식 JSON 변환
```

### Priority 3: Hub 노드 차단 로직 (Phase 3 선행 준비)

```python
# 연결 수 > 50인 노드를 전파 차단 대상으로 등록
HUB_THRESHOLD = 50
```

---

## 10. 결론

### 현재 위치

```
컨설팅 목표 아키텍처의 구현 진행률:

데이터 체계 (메타데이터/분류) ████████████████████ 90%
관계 정의 (엣지/온톨로지)     ████████████████████ 90%
검색 로직 (그래프 전파)       ██████████████░░░░░░ 70%
앵커 검색 (벡터 유사도)       ███░░░░░░░░░░░░░░░░░ 15%
Scope 필터링                 ░░░░░░░░░░░░░░░░░░░░  0%
JSON Payload                 ██████░░░░░░░░░░░░░░ 30%
REST API                     ░░░░░░░░░░░░░░░░░░░░  0%
```

### 핵심 메시지

> **"재료의 품질(데이터 체계)"은 90% 준비 완료.**
> **"배송 시스템(API/Payload)"이 다음 구현 대상.**
>
> 현재 온톨로지 검증(16/16 통과)이 증명하는 것:
> - 문서 관계가 정확히 작동한다 (컨설팅 책임소재: "연결된 문서를 누락했는가?" → NO)
> - 규제 영향이 추적된다 (1200%룰 → 정산프로세스 → 수수료문서)
> - 프로세스별 문서가 정확히 반환된다 (BIZ-SETTLE → 4유형)
>
> **즉, "창고의 재료 품질"은 검증되었고, "배송 인프라"를 구축할 차례.**
