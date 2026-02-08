# Phase 2: 백엔드 구축

> **Version** 3.0 | 2026-02 | 예정 단계

---

## 1. 목표

**전사 지식관리 시스템의 백엔드 인프라를 구축한다.**

Phase 1에서 검증된 분류체계를 실제 데이터베이스와 API로 구현:
- Vue 3 앱 + REST API 서버
- Neo4j 그래프 DB로 관계 탐색
- Qdrant 벡터 DB로 시맨틱 검색

---

## 2. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | Vue 3 + Vue Router + Pinia | 회사 표준 |
| API 서버 | Node.js (Express) | Vue 생태계 |
| 그래프 DB | Neo4j | 관계 탐색 |
| 벡터 DB | Qdrant | 시맨틱 검색 |
| 파일 저장 | NAS / Blob Storage | 원본 문서 |

---

## 3. API 설계

### 3.1 문서 조회

```
GET /documents?carrier={}&product={}&doc_type={}
GET /documents/{id}
GET /documents/{id}/neighbors?depth={}
```

### 3.2 분류 데이터

```
GET /domains
GET /domains/{id}/facets
GET /domains/{id}/masters   # carrier, product 목록
```

### 3.3 관계 탐색

```
GET /documents/{id}/relations?type={}
GET /documents/{id}/propagate?depth={}
```

### 3.4 라이프사이클

```
PATCH /documents/{id}/status
POST /documents/{id}/review
POST /documents/{id}/supersede
```

---

## 4. 데이터 모델

### 4.1 Neo4j 노드

```cypher
// 문서 노드
CREATE (d:Document {
  id: "DOC-001",
  domain: "GA-SALES",
  lifecycle: "ACTIVE",
  version: {major: 1, minor: 0},
  createdAt: datetime(),
  updatedAt: datetime()
})

// 분류 속성
SET d.carrier = "INS-SAMSUNG"
SET d.product = "PRD-LIFE-WHOLE"
SET d.docType = "DOC-TERMS"
SET d.tier = "COLD"
```

### 4.2 관계

```cypher
// 부모-자식
(parent)-[:PARENT_OF]->(child)
(child)-[:CHILD_OF]->(parent)

// 형제
(doc1)-[:SIBLING]->(doc2)

// 참조 (크로스 도메인 가능)
(doc1)-[:REFERENCE]->(doc2)

// 버전 대체
(new)-[:SUPERSEDES]->(old)
```

---

## 5. 문서 파이프라인

```
[업로드]
    │
    ▼
[파일명 파싱] → 보험사/상품/유형 자동 추출
    │
    ▼
[중복 검사] → SSOT 위반 시 경고
    │
    ▼
[메타데이터 입력] → 분류 확정 + 관계 설정
    │
    ▼
[텍스트 추출] → PDF/HWP 파싱
    │
    ▼
[청킹] → 문서유형별 전략 적용
    │
    ▼
[임베딩] → Qdrant 저장
    │
    ▼
[활성화] → lifecycle = ACTIVE
```

---

## 6. Hot-Warm-Cold 인덱스 분리

| 티어 | Qdrant Collection | 재인덱싱 | 문서유형 |
|------|------------------|---------|---------|
| HOT | `idx_hot` | 매일 | 시책, 수수료, 보험료표 |
| WARM | `idx_warm` | 주간 | 상품설명서, 스크립트, 심사가이드 |
| COLD | `idx_cold` | 분기 | 약관, 교육자료, 규정 |

---

## 7. 완료 기준

| 기준 | 상태 |
|------|------|
| Vue 앱 기본 구조 구축 | 예정 |
| REST API 엔드포인트 구현 | 예정 |
| Neo4j 스키마 및 데이터 마이그레이션 | 예정 |
| Qdrant 벡터 인덱스 구축 | 예정 |
| 문서 업로드 파이프라인 동작 | 예정 |
| SSOT 유니크 제약 DB 레벨 적용 | 예정 |

---

## 8. 다음 단계

Phase 2 완료 후 → **Phase 3: RAG 시스템 연동**
- 자연어 → API 변환
- 벡터 검색 + 그래프 탐색 통합
- LLM 응답 생성 + 출처 인용
