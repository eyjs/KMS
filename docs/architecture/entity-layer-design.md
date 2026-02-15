# Entity 레이어 설계 (ADR-017)

> 온톨로지 클래스 개념을 기존 시스템에 영향 없이 도입하기 위한 설계

## 배경

### 현재 구조의 한계
- 모든 노드가 "문서(Document)"로 단일 타입
- "보험사가 상품을 제공한다" 같은 다중 엔티티 관계 표현 불가
- 지식그래프가 문서 관계에 한정됨

### 목표
- 문서 외 엔티티(보험사, 상품, 사람 등) 표현 가능
- 기존 Document 레이어 100% 하위호환
- 점진적 도입 (레이어 방식)

---

## 설계 원칙

| # | 원칙 | 설명 |
|---|------|------|
| 1 | 기존 불변 | Document 테이블/API 변경 없음 |
| 2 | 옵션 추가 | 새 기능은 쿼리 파라미터/플래그로 활성화 |
| 3 | 독립 레이어 | Entity는 Document와 병렬, 의존 없음 |
| 4 | 하위호환 | 기존 관계는 그대로 동작 |

---

## 데이터 모델

### 1. EntityClassMaster (엔티티 클래스 정의)

```sql
CREATE TABLE entity_class_master (
  code VARCHAR(30) PRIMARY KEY,        -- 'DOCUMENT', 'CARRIER', 'PRODUCT', 'PERSON'
  label VARCHAR(50) NOT NULL,          -- 영문 라벨
  label_ko VARCHAR(50) NOT NULL,       -- 한국어 라벨
  parent_code VARCHAR(30),             -- 상속 (예: POLICY → DOCUMENT)
  is_system BOOLEAN DEFAULT false,     -- 시스템 클래스 (DOCUMENT)
  icon VARCHAR(50),                    -- UI 아이콘
  color VARCHAR(20),                   -- UI 색상
  schema JSONB,                        -- 클래스별 속성 스키마 (선택)
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (parent_code) REFERENCES entity_class_master(code)
);
```

**시드 데이터:**
```sql
INSERT INTO entity_class_master (code, label, label_ko, is_system, icon, color) VALUES
  ('DOCUMENT', 'Document', '문서', true, 'document', '#409eff'),
  ('CARRIER', 'Carrier', '보험사', false, 'building', '#67c23a'),
  ('PRODUCT', 'Product', '상품', false, 'box', '#e6a23c'),
  ('PERSON', 'Person', '사람', false, 'user', '#909399'),
  ('REGULATION', 'Regulation', '규정', false, 'scale', '#f56c6c');
```

### 2. Entities (문서 외 엔티티)

```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code VARCHAR(30) NOT NULL REFERENCES entity_class_master(code),
  code VARCHAR(50) UNIQUE,             -- 선택적 코드 (INS-SAMSUNG)
  name VARCHAR(200) NOT NULL,          -- 표시명
  description TEXT,
  data JSONB,                          -- 클래스별 추가 속성
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_entities_class ON entities(class_code);
CREATE INDEX idx_entities_name ON entities(name);
```

**예시 데이터:**
```sql
INSERT INTO entities (class_code, code, name, data) VALUES
  ('CARRIER', 'INS-SAMSUNG', '삼성생명', '{"type": "life", "founded": 1957}'),
  ('CARRIER', 'INS-HANWHA', '한화생명', '{"type": "life", "founded": 1946}'),
  ('PRODUCT', 'PRD-WHOLE-LIFE', '종신보험', '{"category": "life", "carrier": "INS-SAMSUNG"}'),
  ('REGULATION', 'REG-INSURANCE-ACT', '보험업법', '{"effectiveDate": "2024-01-01"}');
```

### 3. Relations 확장 (하위호환)

```sql
-- 기존 컬럼 유지 (변경 없음)
-- source_id UUID REFERENCES documents(id)
-- target_id UUID REFERENCES documents(id)

-- 새 컬럼 추가 (nullable)
ALTER TABLE relations ADD COLUMN source_entity_id UUID REFERENCES entities(id);
ALTER TABLE relations ADD COLUMN target_entity_id UUID REFERENCES entities(id);

-- 인덱스
CREATE INDEX idx_relations_source_entity ON relations(source_entity_id) WHERE source_entity_id IS NOT NULL;
CREATE INDEX idx_relations_target_entity ON relations(target_entity_id) WHERE target_entity_id IS NOT NULL;
```

**관계 해석 로직:**
```
source = source_entity_id ?? source_id  (Entity 우선, 없으면 Document)
target = target_entity_id ?? target_id
```

### 4. 새 관계 유형 추가

```sql
INSERT INTO relation_type_master (code, label, label_ko, inverse_code, requires_domain) VALUES
  ('PROVIDES', 'Provides', '제공', 'PROVIDED_BY', false),
  ('PROVIDED_BY', 'Provided By', '제공받음', 'PROVIDES', false),
  ('BELONGS_TO', 'Belongs To', '소속', 'HAS_MEMBER', false),
  ('HAS_MEMBER', 'Has Member', '소속원', 'BELONGS_TO', false),
  ('REGULATES', 'Regulates', '규제', 'REGULATED_BY', false),
  ('REGULATED_BY', 'Regulated By', '규제받음', 'REGULATES', false);
```

---

## API 설계

### 1. Entity CRUD

```
GET    /entities                    # 목록 (class 필터 가능)
GET    /entities/:id                # 상세
POST   /entities                    # 생성
PATCH  /entities/:id                # 수정
DELETE /entities/:id                # 삭제

GET    /entity-classes              # 클래스 목록
```

### 2. 지식그래프 확장

```
GET /knowledge-graph/explore?startId=xxx&includeEntities=true

응답:
{
  nodes: [
    { id, type: 'document', ... },     // 기존 문서 노드
    { id, type: 'entity', classCode: 'CARRIER', name: '삼성생명', ... }  // 새 엔티티 노드
  ],
  edges: [...]
}
```

### 3. 관계 생성 확장

```typescript
// 기존 (Document ↔ Document)
POST /relations
{ sourceId: 'doc-uuid', targetId: 'doc-uuid', relationType: 'PARENT_OF' }

// 새로 (Entity ↔ Document, Entity ↔ Entity)
POST /relations
{ 
  sourceEntityId: 'carrier-uuid',  // Entity
  targetId: 'doc-uuid',            // Document
  relationType: 'PROVIDES' 
}
```

---

## 프론트엔드 확장

### 1. 그래프 노드 스타일

```typescript
const NODE_STYLES = {
  document: { shape: 'dot', color: '#409eff' },
  CARRIER: { shape: 'diamond', color: '#67c23a' },
  PRODUCT: { shape: 'square', color: '#e6a23c' },
  PERSON: { shape: 'triangleDown', color: '#909399' },
  REGULATION: { shape: 'star', color: '#f56c6c' },
}
```

### 2. 새 뷰 (선택)

- `/entities` - 엔티티 관리 페이지
- `/ontology` - 온톨로지 뷰어 (클래스 계층 + 관계)

---

## 마이그레이션 계획

| 단계 | 작업 | 기존 영향 | 예상 시간 |
|------|------|----------|----------|
| 1 | entity_class_master 테이블 + 시드 | ❌ 없음 | 30분 |
| 2 | entities 테이블 | ❌ 없음 | 30분 |
| 3 | relations에 nullable 컬럼 추가 | ❌ 없음 | 15분 |
| 4 | relation_type_master 시드 추가 | ❌ 없음 | 15분 |
| 5 | Entity API 모듈 생성 | ❌ 없음 | 2시간 |
| 6 | 지식그래프 API 확장 (옵션 플래그) | ❌ 없음 | 1시간 |
| 7 | 프론트엔드 그래프 노드 타입 분기 | ❌ 없음 | 1시간 |
| 8 | Entity 관리 UI (선택) | ❌ 없음 | 3시간 |

**총 예상: 8~10시간 (Phase 2.5 또는 Phase 3 초반)**

---

## 사용 시나리오

### Before (현재)
```
약관문서A ──PARENT_OF──> 가이드문서B
```

### After (Entity 도입 후)
```
삼성생명(Carrier) ──제공──> 종신보험(Product)
종신보험(Product) ──관련문서──> 약관.pdf(Document)
보험업법(Regulation) ──규제──> 종신보험(Product)
```

---

## 향후 확장

- **Phase 4**: Entity 임베딩 → 의미론적 검색
- **Phase 5**: RAG에서 Entity 컨텍스트 활용
  - "삼성생명 종신보험 수수료 알려줘" → 자동으로 관련 문서 탐색

---

## 참고

- ADR-016: 지식그래프 API 설계
- ADR-013: 프레임워크 아키텍처
