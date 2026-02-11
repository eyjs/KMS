-- ============================================================
-- 트리거 및 함수 (Prisma 마이그레이션 후 수동 실행)
-- ============================================================

-- 1. 순환 참조 방지 (domain_code 대응)
CREATE OR REPLACE FUNCTION check_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
    has_cycle BOOLEAN;
BEGIN
    -- domain-scoped 관계만 순환 체크 (같은 도메인 내에서만 의미 있음)
    IF NEW.relation_type NOT IN ('PARENT_OF', 'CHILD_OF') THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE path AS (
        SELECT target_id, ARRAY[NEW.source_id, target_id] AS visited
        FROM relations
        WHERE source_id = NEW.target_id
          AND relation_type IN ('PARENT_OF', 'CHILD_OF')
          AND (
            (NEW.domain_code IS NOT NULL AND domain_code = NEW.domain_code)
            OR (NEW.domain_code IS NULL AND domain_code IS NULL)
          )

        UNION ALL

        SELECT r.target_id, p.visited || r.target_id
        FROM relations r
        JOIN path p ON r.source_id = p.target_id
        WHERE NOT r.target_id = ANY(p.visited)
          AND r.relation_type IN ('PARENT_OF', 'CHILD_OF')
          AND (
            (NEW.domain_code IS NOT NULL AND r.domain_code = NEW.domain_code)
            OR (NEW.domain_code IS NULL AND r.domain_code IS NULL)
          )
    )
    SELECT EXISTS (
        SELECT 1 FROM path WHERE target_id = NEW.source_id
    ) INTO has_cycle;

    IF has_cycle THEN
        RAISE EXCEPTION 'Circular reference detected';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_cycle ON relations;
CREATE TRIGGER trg_check_cycle
BEFORE INSERT OR UPDATE ON relations
FOR EACH ROW EXECUTE FUNCTION check_circular_reference();

-- 2. Updated_at + row_version 자동 갱신
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.row_version = OLD.row_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_timestamp ON documents;
CREATE TRIGGER trg_doc_timestamp
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 3. Relations partial unique indexes (Prisma에서 지원하지 않는 partial index)
-- domain-scoped 관계: (source, target, type, domain) 유니크
DROP INDEX IF EXISTS rel_domain_scoped;
CREATE UNIQUE INDEX rel_domain_scoped
  ON relations(source_id, target_id, relation_type, domain_code)
  WHERE domain_code IS NOT NULL;

-- document-level 관계 (SUPERSEDES 등): (source, target, type) 유니크
DROP INDEX IF EXISTS rel_global;
CREATE UNIQUE INDEX rel_global
  ON relations(source_id, target_id, relation_type)
  WHERE domain_code IS NULL;

-- 4. 레거시 트리거 정리 (있으면 삭제)
DROP TRIGGER IF EXISTS trg_check_ssot ON documents;
DROP FUNCTION IF EXISTS check_ssot_constraint();
DROP TRIGGER IF EXISTS trg_update_hash ON classifications;
DROP FUNCTION IF EXISTS update_classification_hash();
