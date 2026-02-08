# 시점 기반 문서 추적 (Temporal Document Tracking)

> **Version** 1.0 | 2026-02-08
> **상태**: 설계 필요 (Phase 2 후반 또는 Phase 3)

---

## 1. 문제 정의

### 시나리오

```
[2021년 3월]
- 고객 A가 "든든 어린이보험 v1.0"으로 계약 체결
- 당시 유효했던 문서:
  - 상품설명서 v1.0
  - 약관 v1.0
  - 수수료표 v1.0

[2021년~2026년 사이]
- 상품설명서 10번 개정 (v1.0 → v10.0)
- 약관 5번 개정 (v1.0 → v5.0)
- 수수료표 20번 개정 (v1.0 → v20.0)

[2026년 2월]
- 고객 A: "내 계약 당시 약관 보여주세요"
- 현재 시스템: v5.0만 보여줌 (최신)
- 필요한 것: v1.0 (계약 시점)
```

### 핵심 질문

| 질문 | 현재 시스템 | 필요한 기능 |
|------|------------|------------|
| "지금 유효한 문서는?" | O 가능 | - |
| "이 계약에 적용된 문서는?" | X 불가 | **필요** |
| "2023년 6월 시점 문서는?" | X 불가 | **필요** |
| "이 문서가 언제부터 언제까지 유효했나?" | X 불가 | **필요** |

---

## 2. 현재 설계의 한계

### 현재 데이터 모델

```sql
documents (
    id UUID,
    lifecycle VARCHAR(20),  -- DRAFT, ACTIVE, DEPRECATED
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    ...
)
```

**문제점:**
- `lifecycle`은 현재 상태만 저장
- 언제 ACTIVE가 되었는지 모름
- 언제 DEPRECATED가 되었는지 모름
- 계약과 문서 버전의 연결 없음

### 시각화

```
[현재 저장되는 정보]

문서 v1.0: DEPRECATED (언제 만료? 모름)
문서 v2.0: DEPRECATED (언제 만료? 모름)
문서 v3.0: ACTIVE (언제부터? 모름)

계약 A: 2021-03-15 체결 → 어떤 문서 버전? 모름
```

---

## 3. 해결 방안

### 방안 1: 유효 기간 컬럼 추가 (권장)

문서에 "언제부터 언제까지 유효했는지" 기록합니다.

```sql
ALTER TABLE documents ADD COLUMN valid_from TIMESTAMP;
ALTER TABLE documents ADD COLUMN valid_to TIMESTAMP;

-- 예시 데이터
-- 상품설명서 v1.0: 2021-01-01 ~ 2022-06-30
-- 상품설명서 v2.0: 2022-07-01 ~ 2024-12-31
-- 상품설명서 v3.0: 2025-01-01 ~ NULL (현재 유효)
```

**장점:**
- 스키마 변경 최소화
- 시점 쿼리 가능: "2021년 3월에 유효했던 문서는?"

**단점:**
- 기존 문서에 유효 기간 소급 입력 필요
- ACTIVE → DEPRECATED 전환 시 valid_to 자동 설정 필요

### 방안 2: 계약-문서 스냅샷 테이블

계약 체결 시점에 어떤 문서 버전이 적용되었는지 별도 저장합니다.

```sql
CREATE TABLE contract_document_snapshot (
    id UUID PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,      -- 외부 계약 시스템 ID
    contract_date DATE NOT NULL,            -- 계약 체결일
    document_id UUID REFERENCES documents,  -- 적용된 문서 버전
    created_at TIMESTAMP DEFAULT NOW()
);

-- 예시 데이터
-- contract_id: CTR-2021-00123
-- contract_date: 2021-03-15
-- document_id: (상품설명서 v1.0의 UUID)
```

**장점:**
- 계약별 정확한 문서 버전 추적
- 과거 데이터 소급 불필요 (새 계약부터 적용)

**단점:**
- 외부 계약 시스템과 연동 필요
- 계약 체결 시 스냅샷 생성 프로세스 필요

### 방안 3: 이력 테이블 (Audit Log 확장)

문서 상태 변경 이력을 모두 기록합니다.

```sql
-- 기존 document_history 테이블 활용
-- action = 'LIFECYCLE_CHANGE' 시 상세 기록

{
    "document_id": "...",
    "action": "LIFECYCLE_CHANGE",
    "changes": {
        "from": "DRAFT",
        "to": "ACTIVE",
        "effective_date": "2021-01-01"
    }
}
```

**장점:**
- 기존 테이블 활용
- 모든 변경 이력 추적

**단점:**
- 쿼리 복잡 (JSONB 파싱)
- 성능 이슈 가능

---

## 4. 권장 설계

### Phase 2: 기본 인프라

```sql
-- 문서 테이블에 유효 기간 추가
ALTER TABLE documents ADD COLUMN valid_from TIMESTAMP;
ALTER TABLE documents ADD COLUMN valid_to TIMESTAMP;

-- 인덱스
CREATE INDEX idx_doc_valid_period ON documents(valid_from, valid_to);
```

**자동화 규칙:**
1. DRAFT → ACTIVE 전환 시: `valid_from = NOW()`
2. ACTIVE → DEPRECATED 전환 시: `valid_to = NOW()`
3. 새 문서 ACTIVE 시: 기존 ACTIVE 문서의 `valid_to = NOW()`

### Phase 3: 계약 연동

```sql
-- 계약-문서 스냅샷 테이블
CREATE TABLE contract_document_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 계약 정보 (외부 시스템)
    contract_id VARCHAR(50) NOT NULL,
    contract_date DATE NOT NULL,

    -- 적용 문서
    document_id UUID REFERENCES documents(id),

    -- 메타
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(contract_id, document_id)
);

CREATE INDEX idx_snapshot_contract ON contract_document_snapshot(contract_id);
CREATE INDEX idx_snapshot_date ON contract_document_snapshot(contract_date);
```

---

## 5. 사용 시나리오

### 시나리오 1: 시점 기준 문서 조회

**요청:** "2021년 3월 15일 시점에 유효했던 삼성생명 종신보험 문서들"

```sql
SELECT * FROM documents
WHERE domain = 'GA-SALES'
  AND valid_from <= '2021-03-15'
  AND (valid_to IS NULL OR valid_to > '2021-03-15')
  AND classification_hash = (
    SELECT classification_hash FROM documents
    WHERE ... -- 삼성생명 > 종신보험 조건
  );
```

### 시나리오 2: 계약 기준 문서 조회

**요청:** "계약번호 CTR-2021-00123에 적용된 모든 문서"

```sql
SELECT d.*
FROM contract_document_snapshot s
JOIN documents d ON s.document_id = d.id
WHERE s.contract_id = 'CTR-2021-00123';
```

### 시나리오 3: 문서 유효 기간 조회

**요청:** "이 문서가 언제부터 언제까지 유효했나?"

```sql
SELECT
    file_name,
    version_major || '.' || version_minor AS version,
    valid_from,
    valid_to,
    CASE
        WHEN valid_to IS NULL THEN '현재 유효'
        ELSE valid_to::text
    END AS status
FROM documents
WHERE classification_hash = '...'
ORDER BY valid_from DESC;
```

**결과:**
```
file_name         | version | valid_from  | valid_to    | status
------------------+---------+-------------+-------------+------------
상품설명서        | 3.0     | 2025-01-01  | NULL        | 현재 유효
상품설명서        | 2.0     | 2022-07-01  | 2024-12-31  | 2024-12-31
상품설명서        | 1.0     | 2021-01-01  | 2022-06-30  | 2022-06-30
```

---

## 6. UI 반영

### 문서 상세 화면

```
┌─────────────────────────────────────────────────────┐
│ 삼성생명 > 종신보험 > 상품설명서 v3.0               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  상태: 🟢 사용 중 (ACTIVE)                          │
│  유효 기간: 2025-01-01 ~ (현재)                    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  📜 버전 이력                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ v3.0 │ 2025-01-01 ~ 현재    │ ACTIVE       │   │
│  │ v2.0 │ 2022-07-01 ~ 2024-12 │ DEPRECATED   │   │
│  │ v1.0 │ 2021-01-01 ~ 2022-06 │ DEPRECATED   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 시점 조회 기능

```
┌─────────────────────────────────────────────────────┐
│ 🕐 시점 기준 조회                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  기준일: [2021-03-15] 📅                            │
│                                                     │
│  [조회]                                             │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  2021-03-15 시점 유효 문서:                         │
│  ├── 📄 상품설명서 v1.0                             │
│  ├── 📄 약관 v1.0                                   │
│  └── 📄 수수료표 v3.0                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. 구현 우선순위

| 단계 | 기능 | 구현 시점 |
|------|------|----------|
| 1 | `valid_from`, `valid_to` 컬럼 추가 | Phase 2 후반 |
| 2 | 라이프사이클 전환 시 자동 설정 | Phase 2 후반 |
| 3 | 시점 기준 조회 API | Phase 2 후반 |
| 4 | 버전 이력 UI | Phase 2 후반 |
| 5 | 계약 스냅샷 테이블 | Phase 3 |
| 6 | 외부 계약 시스템 연동 | Phase 3 |
| 7 | 계약 기준 조회 UI | Phase 3 |

---

## 8. 데이터 마이그레이션

### 기존 데이터 처리

Phase 2 도입 시점에 기존 문서들의 `valid_from`, `valid_to` 값 설정:

```sql
-- 현재 ACTIVE 문서: valid_from = created_at, valid_to = NULL
UPDATE documents
SET valid_from = created_at, valid_to = NULL
WHERE lifecycle = 'ACTIVE';

-- DEPRECATED 문서: valid_from = created_at, valid_to = updated_at
UPDATE documents
SET valid_from = created_at, valid_to = updated_at
WHERE lifecycle = 'DEPRECATED';

-- DRAFT 문서: 유효 기간 없음
UPDATE documents
SET valid_from = NULL, valid_to = NULL
WHERE lifecycle = 'DRAFT';
```

**한계:**
- 정확한 유효 기간을 알 수 없음 (created_at, updated_at으로 추정)
- 과거 계약에 대한 정확한 문서 버전 매칭은 수동 작업 필요

---

## 9. 외부 시스템 연동

### 계약 시스템 연동 흐름

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  계약 시스템  │────►│    KMS      │────►│  스냅샷 DB   │
│  (외부)      │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘

1. 계약 체결 시 계약 시스템이 KMS에 알림
2. KMS가 해당 시점 유효 문서 조회
3. 계약-문서 스냅샷 저장
```

### API 설계 (Phase 3)

```
POST /api/v1/contracts/{contract_id}/snapshot
{
    "contract_date": "2021-03-15",
    "product_code": "PRD-LIFE-WHOLE",
    "carrier_code": "INS-SAMSUNG"
}

Response:
{
    "success": true,
    "data": {
        "contract_id": "CTR-2021-00123",
        "snapshot_date": "2021-03-15",
        "documents": [
            { "id": "...", "name": "상품설명서", "version": "1.0" },
            { "id": "...", "name": "약관", "version": "1.0" },
            { "id": "...", "name": "수수료표", "version": "3.0" }
        ]
    }
}
```

---

## 10. 결론

### 현재 Gap

- 문서의 "현재 상태"만 저장
- "언제부터 언제까지 유효했는지" 추적 불가
- 계약과 문서 버전 연결 없음

### 해결 방향

1. **Phase 2 후반**: `valid_from`, `valid_to` 컬럼 추가 + 시점 조회
2. **Phase 3**: 계약-문서 스냅샷 테이블 + 외부 시스템 연동

### 비즈니스 가치

- 과거 계약에 적용된 정확한 문서 확인 가능
- 민원 대응 시 "그때 그 약관" 즉시 제공
- 컴플라이언스 감사 대응 용이

---

**문서 끝**
