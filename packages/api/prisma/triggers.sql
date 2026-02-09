-- ============================================================
-- 트리거 및 함수 (Prisma 마이그레이션 후 수동 실행)
-- ============================================================

-- 1. 순환 참조 방지
CREATE OR REPLACE FUNCTION check_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
    has_cycle BOOLEAN;
BEGIN
    WITH RECURSIVE path AS (
        SELECT target_id, ARRAY[NEW.source_id, target_id] AS visited
        FROM relations
        WHERE source_id = NEW.target_id
          AND relation_type IN ('PARENT_OF', 'CHILD_OF')

        UNION ALL

        SELECT r.target_id, p.visited || r.target_id
        FROM relations r
        JOIN path p ON r.source_id = p.target_id
        WHERE NOT r.target_id = ANY(p.visited)
          AND r.relation_type IN ('PARENT_OF', 'CHILD_OF')
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

-- 2. SSOT 검증 (같은 분류 경로에 ACTIVE 1개만)
CREATE OR REPLACE FUNCTION check_ssot_constraint()
RETURNS TRIGGER AS $$
DECLARE
    existing_count INT;
BEGIN
    IF NEW.lifecycle = 'ACTIVE' AND (OLD IS NULL OR OLD.lifecycle != 'ACTIVE') THEN
        SELECT COUNT(*) INTO existing_count
        FROM documents
        WHERE classification_hash = NEW.classification_hash
          AND lifecycle = 'ACTIVE'
          AND id != NEW.id
          AND is_deleted = false;

        IF existing_count > 0 THEN
            RAISE EXCEPTION 'SSOT violation: Active document already exists for this classification';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_ssot ON documents;
CREATE TRIGGER trg_check_ssot
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION check_ssot_constraint();

-- 3. Classification Hash 자동 생성
CREATE OR REPLACE FUNCTION update_classification_hash()
RETURNS TRIGGER AS $$
DECLARE
    hash_input TEXT;
    doc_domain TEXT;
    doc_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        doc_id := OLD.document_id;
    ELSE
        doc_id := NEW.document_id;
    END IF;

    SELECT string_agg(facet_type || ':' || facet_value, '|' ORDER BY facet_type)
    INTO hash_input
    FROM classifications
    WHERE document_id = doc_id;

    SELECT domain INTO doc_domain
    FROM documents
    WHERE id = doc_id;

    UPDATE documents
    SET classification_hash = encode(
        sha256((doc_domain || '|' || COALESCE(hash_input, ''))::bytea),
        'hex'
    )
    WHERE id = doc_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_hash ON classifications;
CREATE TRIGGER trg_update_hash
AFTER INSERT OR UPDATE OR DELETE ON classifications
FOR EACH ROW EXECUTE FUNCTION update_classification_hash();

-- 4. Updated_at + row_version 자동 갱신
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
