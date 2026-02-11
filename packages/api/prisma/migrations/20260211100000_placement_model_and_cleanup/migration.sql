-- Phase B: 배치 모델 추가 + Phase E: 레거시 정리
-- ============================================================

-- 1. 새 테이블: domain_categories (도메인 내 카테고리 트리)
CREATE TABLE IF NOT EXISTS "domain_categories" (
    "id" SERIAL NOT NULL,
    "domain_code" VARCHAR(20) NOT NULL,
    "parent_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_categories_pkey" PRIMARY KEY ("id")
);

-- 2. 새 테이블: document_placements (문서-도메인 M:N 바로가기)
CREATE TABLE IF NOT EXISTS "document_placements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "domain_code" VARCHAR(20) NOT NULL,
    "category_id" INTEGER,
    "placed_by" UUID,
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alias" VARCHAR(200),
    "note" VARCHAR(500),

    CONSTRAINT "document_placements_pkey" PRIMARY KEY ("id")
);

-- 3. documents 테이블 변경
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_hash" VARCHAR(64);

-- 4. relations 테이블 변경
ALTER TABLE "relations" ADD COLUMN IF NOT EXISTS "domain_code" VARCHAR(20);

-- 5. domain_master: requiredFacets, ssotKey nullable화 (컬럼이 아직 존재하는 경우에만)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='domain_master' AND column_name='required_facets') THEN
    ALTER TABLE "domain_master" ALTER COLUMN "required_facets" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='domain_master' AND column_name='ssot_key') THEN
    ALTER TABLE "domain_master" ALTER COLUMN "ssot_key" DROP NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 인덱스 생성
-- ============================================================

-- domain_categories 인덱스
CREATE INDEX IF NOT EXISTS "domain_categories_domain_code_idx" ON "domain_categories"("domain_code");
CREATE INDEX IF NOT EXISTS "domain_categories_parent_id_idx" ON "domain_categories"("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_categories_domain_code_parent_id_name_key"
  ON "domain_categories"("domain_code", "parent_id", "name");

-- document_placements 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "document_placements_document_id_domain_code_key"
  ON "document_placements"("document_id", "domain_code");
CREATE INDEX IF NOT EXISTS "document_placements_document_id_idx" ON "document_placements"("document_id");
CREATE INDEX IF NOT EXISTS "document_placements_domain_code_idx" ON "document_placements"("domain_code");
CREATE INDEX IF NOT EXISTS "document_placements_category_id_idx" ON "document_placements"("category_id");

-- documents.file_hash 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "documents_file_hash_key" ON "documents"("file_hash");
CREATE INDEX IF NOT EXISTS "documents_file_hash_idx" ON "documents"("file_hash");

-- relations.domain_code 인덱스
CREATE INDEX IF NOT EXISTS "relations_domain_code_idx" ON "relations"("domain_code");

-- ============================================================
-- 외래 키 제약
-- ============================================================

-- domain_categories FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'domain_categories_domain_code_fkey') THEN
    ALTER TABLE "domain_categories" ADD CONSTRAINT "domain_categories_domain_code_fkey"
      FOREIGN KEY ("domain_code") REFERENCES "domain_master"("code") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'domain_categories_parent_id_fkey') THEN
    ALTER TABLE "domain_categories" ADD CONSTRAINT "domain_categories_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "domain_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- document_placements FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_placements_document_id_fkey') THEN
    ALTER TABLE "document_placements" ADD CONSTRAINT "document_placements_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_placements_domain_code_fkey') THEN
    ALTER TABLE "document_placements" ADD CONSTRAINT "document_placements_domain_code_fkey"
      FOREIGN KEY ("domain_code") REFERENCES "domain_master"("code") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_placements_category_id_fkey') THEN
    ALTER TABLE "document_placements" ADD CONSTRAINT "document_placements_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "domain_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_placements_placed_by_fkey') THEN
    ALTER TABLE "document_placements" ADD CONSTRAINT "document_placements_placed_by_fkey"
      FOREIGN KEY ("placed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- relations.domain_code FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relations_domain_code_fkey') THEN
    ALTER TABLE "relations" ADD CONSTRAINT "relations_domain_code_fkey"
      FOREIGN KEY ("domain_code") REFERENCES "domain_master"("code") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 기존 relations unique 제약 변경 (partial index)
-- ============================================================

-- 기존 unique index 삭제
DROP INDEX IF EXISTS "relations_source_id_target_id_relation_type_key";

-- domain-scoped 관계 유니크
DROP INDEX IF EXISTS "rel_domain_scoped";
CREATE UNIQUE INDEX "rel_domain_scoped"
  ON "relations"("source_id", "target_id", "relation_type", "domain_code")
  WHERE "domain_code" IS NOT NULL;

-- global 관계 유니크 (SUPERSEDES 등)
DROP INDEX IF EXISTS "rel_global";
CREATE UNIQUE INDEX "rel_global"
  ON "relations"("source_id", "target_id", "relation_type")
  WHERE "domain_code" IS NULL;

-- ============================================================
-- Phase E: 레거시 테이블/컬럼 정리
-- ============================================================

-- classifications 테이블 삭제
DROP TABLE IF EXISTS "classifications" CASCADE;

-- facet_master 테이블 삭제
DROP TABLE IF EXISTS "facet_master" CASCADE;

-- facet_type_master 테이블 삭제
DROP TABLE IF EXISTS "facet_type_master" CASCADE;

-- documents.domain 컬럼 삭제
ALTER TABLE "documents" DROP COLUMN IF EXISTS "domain";

-- documents.classification_hash 컬럼 삭제
ALTER TABLE "documents" DROP COLUMN IF EXISTS "classification_hash";

-- domain_master.required_facets 컬럼 삭제
ALTER TABLE "domain_master" DROP COLUMN IF EXISTS "required_facets";

-- domain_master.ssot_key 컬럼 삭제
ALTER TABLE "domain_master" DROP COLUMN IF EXISTS "ssot_key";

-- documents.domain 인덱스 삭제 (컬럼 삭제 시 자동이지만 명시적으로)
DROP INDEX IF EXISTS "documents_domain_idx";
DROP INDEX IF EXISTS "documents_classification_hash_idx";

-- 레거시 트리거/함수 삭제
DROP TRIGGER IF EXISTS "trg_check_ssot" ON "documents";
DROP FUNCTION IF EXISTS "check_ssot_constraint"();
DROP TRIGGER IF EXISTS "trg_update_hash" ON "classifications";
DROP FUNCTION IF EXISTS "update_classification_hash"();
