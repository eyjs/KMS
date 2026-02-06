# Warehouse → Core Brain 단계별 장악 전략서

> **작성일**: 2026-02-06
> **버전**: v3.0
> **핵심 원칙**: 창고에 두뇌를 넣지 않는다. 창고는 기계이고, 두뇌는 별도로 키운다.

---

## 0. 3-Phase 정의

```
Phase 1 (지금)              Phase 2                    Phase 3
지식체계 수립                백엔드 API + DB 구축         미들웨어 구축
━━━━━━━━━━━━━━             ━━━━━━━━━━━━━━             ━━━━━━━━━━━━━━
• 도메인 분류               • REST API 구현             • 자연어 → API 파라미터 변환
• 문서체계/문서형태 수립      • Neo4j 적재               • 반환 문서 유사도 검증
• 관계(엣지) 수립            • Qdrant 벡터DB            • 최종 응답 패키징
• SSOT / 라이프사이클        • 파라미터 기반 기계적 조회   • 외부 업체는 UI+LLM만
• "Phase 2 API로 서빙        • 창고 실물 구축
   가능한 구조인가?" 검증
```

**핵심**: Phase 1은 설계도, Phase 2는 건물, Phase 3은 안내 데스크.

---

## 1. Phase 1: 지식체계 수립 (The Blueprint) — 현재

### 1.1 Phase 1이 검증해야 하는 것

Phase 2에서 백엔드 API가 실제 서빙할 때, 이 구조로 **파라미터 기반 조회가 가능한가?**

| 검증 항목 | 질문 | 현재 상태 |
|----------|------|----------|
| **도메인 분류** | 모든 GA 문서를 빠짐없이 분류할 수 있는가? | ✅ 6-Facet (41 문서유형) |
| **문서체계** | 문서 유형이 충분히 세분화되어 있는가? | ✅ HOT 9 / WARM 15 / COLD 17 |
| **문서형태** | 각 문서유형의 청킹/저장 전략이 정의되어 있는가? | ⚠️ 설계됨, 구현 Phase 2 |
| **관계 수립** | 엣지가 정확하고, API 파라미터로 필터 가능한가? | ✅ 9종 엣지, 1928개 검증 |
| **파라미터 조회** | carrier+product+doc_type+edge_type로 원하는 문서를 꺼낼 수 있는가? | ✅ warehouse_api.py 검증 |
| **SSOT** | 동일 경로에 중복 없이 단일 출처를 보장하는가? | ✅ 유니크 제약 검증 |
| **라이프사이클** | Hot/Warm/Cold 티어와 문서 상태 전이가 대응되는가? | ✅ 설계 완료 |

### 1.2 Phase 1 산출물

| 산출물 | 파일 | 역할 |
|--------|------|------|
| 6-Facet 분류체계 | `taxonomy_v2_extended.py` | 도메인 분류의 마스터 정의 |
| 온톨로지 클래스 계층 | `taxonomy_ontology.py` | 클래스 상속, 동의어 사전, 개념 정의 |
| 지식그래프 (검증용) | `knowledge_graph_ontology.json` | 669노드, 1928엣지 시뮬레이션 데이터 |
| 창고 API 설계 | `warehouse_api.py` | Phase 2 API의 설계 검증용 프로토타입 |
| 구조 검증 | `ontology_validator.py` | 16/16 온톨로지 구조 테스트 |
| API 조회 검증 | `golden_set.py` + `simulator_phase2.py` | "이 파라미터로 조회하면 이 결과가 나오는가?" |
| 전략 문서 | `strategy-alignment.md` (이 문서) | Phase 간 정렬 |

### 1.3 Phase 1 시뮬레이터의 역할

시뮬레이터는 **Phase 3 미들웨어의 프로토타입이 아니다**.
Phase 2에서 만들 API가 **이 구조로 서빙 가능한지 사전 검증**하는 도구다.

```
시뮬레이터가 하는 일 (Phase 1):

"수수료 문서를 carrier=INS-SAMSUNG, doc_type=DOC-COMMISSION으로
 조회하면 정확히 나오는가?"

"그 문서의 SIBLINGS 엣지를 따라가면 시책 문서가 나오는가?"

"BIZ-SETTLE 프로세스에 USED_IN된 문서가 빠짐없이 나오는가?"

→ 이 검증이 통과하면 Phase 2에서 실제 API를 구현해도 된다는 근거
```

### 1.4 Phase 1 완료 기준

| 기준 | 달성 |
|------|------|
| 6-Facet으로 모든 GA 문서 유형 커버 | ✅ 41종 |
| 9종 관계가 올바르게 연결됨 | ✅ 16/16 통과 |
| 파라미터 기반 조회로 원하는 문서 추출 가능 | ✅ golden_set 10개 시나리오 |
| SSOT 유니크 제약 보장 | ✅ 보험사+상품+문서유형+버전 |
| Hot/Warm/Cold 라이프사이클 설계 | ✅ 문서 상태 전이 정의 |
| 문서 청킹 전략 설계 | ✅ architecture-guide.md |

---

## 2. Phase 2: 백엔드 API + DB 구축 (The Building)

### 2.1 Phase 2가 만드는 것

Phase 1에서 검증한 구조를 **실제 서버와 DB로 구현**한다.

```
Phase 1 (설계도)                     Phase 2 (건물)
──────────────────                  ──────────────────
taxonomy_ontology.py    ──────→     Neo4j 스키마
knowledge_graph.json    ──────→     Neo4j 데이터 적재
warehouse_api.py        ──────→     REST API (Express/FastAPI)
SYNONYM_MAP             ──────→     /thesaurus API 엔드포인트
CONCEPTS                ──────→     /concepts API 엔드포인트
golden_set.py           ──────→     API 통합 테스트 스위트
```

### 2.2 Phase 2 API 스펙 (Phase 1에서 검증 완료)

```
[조건 검색] — 조건에 맞는 문서를 전부 반환
GET /documents?carrier={}&product={}&doc_type={}&tier={}

[단건 조회] — ID로 문서 1건 + 메타데이터
GET /documents/{id}

[엣지 탐색] — 요청한 관계만 기계적으로 반환
GET /documents/{id}/edges?type={SIBLINGS|REFERENCES|GOVERNS|...}

[이웃 탐색] — 요청한 depth/엣지만 반환
GET /documents/{id}/neighbors?depth={1|2}&edge_types={csv}

[프로세스 문서] — 프로세스에 연결된 문서 반환
GET /processes/{id}/documents

[개념 조회] — 개념 노드 + 연결 관계
GET /concepts/{id}

[동의어 사전] — 참조 데이터 제공
GET /thesaurus?keyword={}

[규제 영향] — GOVERNS/RESTRICTS 반환
GET /regulations/{id}/impact
```

**모든 API는 필터 + 반환만 한다. 스코어링, 랭킹, 추천 없음.**

### 2.3 Phase 2 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| API 서버 | Express.js (Vue 생태계) 또는 FastAPI | CLAUDE.md: JS 필수 |
| 그래프 DB | Neo4j | 관계 탐색 |
| 벡터 DB | Qdrant | 시맨틱 검색 (Phase 3용 준비) |
| 문서 저장 | NAS / Blob Storage | 원본 파일 |
| 테스트 | golden_set.py → API 통합 테스트 변환 | Phase 1 자산 재활용 |

---

## 3. Phase 3: 미들웨어 구축 (The Brain)

### 3.1 Phase 3이 하는 일

```
사용자: "삼성생명 종신보험 수수료가 어떻게 되나요?"
         │
         ▼
┌─────────────────────────┐
│ 미들웨어 (Phase 3)       │
│                         │
│ 1. 자연어 → 파라미터 변환 │  "삼성생명" → carrier=INS-SAMSUNG
│    (NLU/의도 분석)       │  "종신보험" → product=PRD-LIFE-WHOLE
│                         │  "수수료" → doc_type=[DOC-COMMISSION,...]
│ 2. Phase 2 API 호출      │
│    GET /documents?...    │
│    GET /documents/{id}/  │
│        neighbors?...     │
│                         │
│ 3. 반환 문서 유사도 검증  │  "이 문서가 질문과 관련 있는가?"
│                         │
│ 4. 응답 패키징           │  anchor + context JSON
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 외부 (UI + LLM)         │
│ • JSON 받아서 답변 생성   │
│ • 근거 문장 하이라이팅    │
│ • 출처 표기              │
└─────────────────────────┘
```

### 3.2 Phase 3 학습 데이터는 어디서 오는가

Phase 1~2에서 축적된 자산:

| 자산 | 출처 | Phase 3 용도 |
|------|------|------------|
| golden_set.py | Phase 1 | 질문→파라미터 변환의 **정답지** |
| SYNONYM_MAP | Phase 1 | 도메인 특화 동의어 변환 규칙 |
| API 호출 로그 | Phase 2 운영 | 실제 사용 패턴 축적 |
| 외부 업체 피드백 | Phase 2 운영 | "이 관계 유형이 유용했다/아니었다" |

### 3.3 최종 R&R

| 역할 | Phase 1~2 | Phase 3 |
|------|-----------|---------|
| **자연어 이해(NLU)** | 외부 | **우리** (미들웨어) |
| **파라미터 결정** | 외부 | **우리** (golden_set 학습) |
| **창고 API 호출** | 외부가 직접 | **미들웨어가 내부 호출** |
| **유사도 검증** | 없음 | **우리** (미들웨어) |
| **응답 패키징** | 외부 | **우리** |
| **답변 생성** | 외부 | 외부 (LLM만) |
| **UI** | 외부 | 외부 (껍데기만) |

---

## 4. 현재 코드의 Phase 귀속

### 4.1 각 파일이 어떤 Phase에 속하는가

```
Phase 1: 지식체계 수립 (현재)
├── taxonomy_v2_extended.py     → 도메인 분류 마스터
├── taxonomy_ontology.py        → 클래스 계층 + 동의어 + 개념
├── simulator_ontology.py       → 검증용 데이터 생성기
├── knowledge_graph_ontology.json → 검증용 시뮬레이션 데이터
├── ontology_validator.py       → 온톨로지 구조 검증 (16/16)
├── warehouse_api.py            → Phase 2 API 설계 검증 프로토타입
├── golden_set.py               → "이 파라미터로 조회 가능한가?" 시나리오
├── simulator_phase2.py         → golden_set 자동 실행 + 검증
└── docs/architecture/*         → 설계 문서

Phase 2: 백엔드 구축 (예정)
├── (미구현) server/            → REST API 서버
├── (미구현) neo4j/             → 그래프 DB 스키마 + 마이그레이션
├── (미구현) qdrant/            → 벡터 DB 임베딩 파이프라인
└── golden_set.py → 통합 테스트  → Phase 1 자산 재활용

Phase 3: 미들웨어 (미래)
├── (미구현) middleware/        → NLU + 파라미터 변환 + 유사도 검증
├── golden_set.py → 학습 데이터  → Phase 1 자산 재활용
└── SYNONYM_MAP → 변환 규칙      → Phase 1 자산 재활용
```

### 4.2 OntologyRAG 클래스의 위치

`ontology_validator.py`의 `OntologyRAG` 클래스는 **Phase 3 미들웨어의 미래 참고 코드**다.
지금 Phase 1에서는 사용하지 않는다. 구조 검증과 golden_set 검증에만 집중한다.

---

## 5. 창고가 보장하는 것 vs 하면 안 되는 것

### 5.1 보장하는 5대 품질 지표

| # | 지표 | 정의 | Phase 1 검증 |
|---|------|------|-------------|
| Q1 | **분류 정확도** | 문서가 올바른 유형으로 분류 | ✅ 3,963항목 |
| Q2 | **관계 정확도** | 엣지가 올바른 노드 쌍 연결 | ✅ 16/16 |
| Q3 | **완전성** | 조건 맞는 문서 누락 없음 | ✅ 시나리오6: 4유형 전수 |
| Q4 | **유니크** | 동일 경로 중복 없음 | ✅ 제약조건 |
| Q5 | **결정론** | 같은 요청 → 같은 결과 | ✅ 스코어링 없음 |

### 5.2 창고가 절대 하면 안 되는 것

| 금지 항목 | 이유 | 누가 해야 하나 |
|----------|------|--------------|
| 스코어링/랭킹 | 판단 = 블랙박스 | Phase 3 미들웨어 |
| 전파 범위 결정 | 어디까지 볼지 = 판단 | 호출자가 depth/edge_types로 지정 |
| 동의어 확장 | 키워드 해석 = 판단 | 호출자가 사전 참조 후 코드로 요청 |
| 유사도 판단 | 관련성 평가 = 판단 | Phase 3 미들웨어 |
| 추천/서제스트 | 주관 개입 | Phase 3 미들웨어 |

---

## 6. 외부 업체 계약 유의사항

> Phase 2까지는 외부가 NLU + 파라미터 결정을 담당하므로,
> 계약서에 다음을 명시해야 한다:
>
> - "Phase 3에서 검색 로직(Router)을 자체 서버로 이관할 로드맵이 있다"
> - "Phase 3에서는 API 규격 변경 가능 (파라미터 → 자연어 수신)"
> - "외부 업체의 NLU/라우터 모듈은 독립적으로 교체 가능해야 한다"

---

## 7. 결론

```
Phase 1  "설계도 검증" (지금)
         → 분류체계, 관계, SSOT, 라이프사이클 수립
         → "Phase 2 API로 서빙 가능한 구조인가?" 시뮬레이션 검증
         → 현재 달성률: 90%

Phase 2  "창고 건설"
         → REST API + Neo4j + Qdrant 실물 구축
         → 파라미터 기반 기계적 조회 서빙 시작
         → 외부 업체가 API를 직접 호출

Phase 3  "뇌 장착"
         → 자연어 → API 파라미터 자동 변환
         → 반환 문서 유사도 검증
         → 외부는 UI + LLM 문장 생성만
         → 플랫폼 주권 확보
```

> **창고에 AI가 붙으면 블랙박스다.**
> **AI는 Phase 3에서, 창고 밖에, 별도 계층에 장착한다.**
