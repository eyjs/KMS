# 문서관리 프레임워크 v3.0

> **Version** 3.0 | 2026-02-08
> **핵심 원칙**: 시스템 프레임워크(불변)와 도메인 설정(가변)의 분리

---

## 1. 프로젝트 비전

```
도메인 무관한 문서관리 프레임워크 구축
├── 시스템 프레임워크 (불변 규칙) → 모든 도메인에 공통 적용
└── 도메인 설정 (가변) → 각 사업부가 자체 정의
```

GA 보험영업을 첫 번째 도메인으로 검증한 뒤, 메디코드 등 다른 사업에도 확장 가능한 구조.

---

## 2. 3-Phase 로드맵

```
Phase 1 (현재)              Phase 2                    Phase 3
분류체계 검증               백엔드 API + DB 구축        RAG 시스템 연동
━━━━━━━━━━━━━━             ━━━━━━━━━━━━━━             ━━━━━━━━━━━━━━
- 프레임워크 설계            - Vue 앱 + REST API        - 자연어 → API 변환
- 도메인 분류체계            - Neo4j 그래프 DB          - 벡터 검색 통합
- JSON 기반 검증            - 문서 파이프라인           - LLM 응답 생성
- Admin HTML 페이지         - Qdrant 벡터 DB           - 출처 인용 시스템
```

---

## 3. 시스템 프레임워크 (불변)

모든 도메인이 반드시 따라야 하는 규칙.

### 3.1 라이프사이클 상태 머신

```
DRAFT ──► REVIEW ──► ACTIVE ──► STALE ──► DEPRECATED ──► ARCHIVED
            │                     ▲
            └── REJECTED          │
                            (신선도 만료 시)
```

| 상태 | 설명 | 검색 가능 |
|------|------|----------|
| DRAFT | 임시 저장 | X |
| REVIEW | 검토 중 | X |
| ACTIVE | 활성 (현행) | O |
| STALE | 신선도 만료 | O (경고 표시) |
| DEPRECATED | 폐기 예정 | O (경고 표시) |
| ARCHIVED | 보관 | X |

### 3.2 신선도 (Freshness)

```
경과일 = 현재일 - max(updatedAt, reviewedAt)

FRESH:   경과일 < maxAgeDays x 0.7
WARNING: 경과일 < maxAgeDays
EXPIRED: 경과일 >= maxAgeDays → 자동 STALE 전환
```

| 티어 | 문서유형 | maxAgeDays |
|------|---------|------------|
| HOT | 시책, 수수료 | 30일 |
| WARM | 상품설명서, 스크립트 | 90일 |
| COLD | 약관, 교육자료 | 365일 |

### 3.3 관계 타입

| 관계 | 양방향 | 크로스 도메인 |
|------|--------|--------------|
| PARENT_OF / CHILD_OF | O | X |
| SIBLING | O | X |
| REFERENCE | X | O |
| SUPERSEDES | X | X |

### 3.4 SSOT 규칙

**도메인 + 분류 경로 내 ACTIVE 문서 1개만 허용**

```
GA-SALES: KB손해보험 > 종신보험 > 상품설명서 (ACTIVE) → 유일
새 문서 ACTIVE 전환 시 → 기존 문서 자동 DEPRECATED
```

### 3.5 버전 규칙

```
버전: Major.Minor

Major 증가 (v1.0 → v2.0):
  - 내용 변경 (수수료율, 조건 등)
  - 신규 버전 = 새 문서 (SUPERSEDES 관계)

Minor 증가 (v1.0 → v1.1):
  - 오타 수정, 서식 변경
  - 동일 문서 업데이트
```

---

## 4. 도메인 설정 (가변)

### 4.1 도메인 정의 구조

```python
DOMAINS = {
    "GA-SALES": {
        "business": "GA",
        "function": "SALES",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "ssotKey": ["carrier", "product", "docType"],
        "freshnessOverrides": {
            "DOC-INCENTIVE": 14,  # 시책은 2주
        },
    },
}
```

### 4.2 현재 GA 도메인 (6개)

| 도메인 | facets (SSOT 키) | 설명 |
|--------|-----------------|------|
| GA-SALES | carrier x product x docType | 영업/상담 문서 |
| GA-COMM | carrier x product x docType | 수수료/정산 문서 |
| GA-CONTRACT | carrier x product x docType | 계약관리 문서 |
| GA-COMP | carrier x docType | 컴플라이언스 (상품 무관) |
| GA-EDU | docType | 교육 (보험사/상품 무관) |
| COMMON-COMP | docType | 전사 공통 규제 |

### 4.3 새 도메인 추가 방법

1. `src/taxonomy.py`의 `BUSINESSES`에 사업 등록
2. `DOMAINS`에 도메인 정의 (facets, ssotKey)
3. 필요시 마스터 데이터 (carriers, products 등) 추가
4. `src/simulator.py`에서 샘플 데이터 생성 로직 추가

---

## 5. 문서 데이터 모델

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
  relations: {
    parent, children, siblings,
    references, supersedes, supersededBy
  },

  // 컨텐츠
  name, content, tier,
}
```

---

## 6. 핵심 설계 원칙

### 6.1 프레임워크가 강제하는 것

- 모든 문서에 고유 ID
- 라이프사이클 상태 머신
- 신선도 자동 계산
- 관계 타입 제한
- SSOT 유니크 제약
- 버전 규칙 (Major.Minor)

### 6.2 프레임워크가 강제하지 않는 것

- 분류 축(facet) 구성 → 도메인마다 다름
- 분류 값 (보험사, 상품 목록 등)
- 문서 본문 형식
- 내부 관계 구조

---

## 7. 성공 지표

| 지표 | Phase 1 | Phase 2 목표 | Phase 3 목표 |
|------|---------|-------------|-------------|
| 도메인 수 | 6 (GA) | 10+ | 15+ |
| 문서 노드 | 767 | 5,000+ | 50,000+ |
| 관계 엣지 | 2,439 | 20,000+ | 200,000+ |
| 온톨로지 검증 | 6/6 | 유지 | 유지 |
| 검색 정확도 | - | 80%+ | 90%+ |

---

## 8. 참고 문서

- `docs/phase1/README.md` - Phase 1 상세
- `docs/phase2/README.md` - Phase 2 상세
- `docs/phase3/README.md` - Phase 3 상세
- `docs/shared/domain-knowledge.md` - GA 산업 도메인 지식
- `CLAUDE.md` - 프로젝트 전체 규칙
