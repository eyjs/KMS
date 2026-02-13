-- Add folder code and permissions columns to domain_categories
-- Add placement_code column to document_placements

-- Step 1: Add new columns to domain_categories
ALTER TABLE "domain_categories" ADD COLUMN "code" VARCHAR(50);
ALTER TABLE "domain_categories" ADD COLUMN "access_level" VARCHAR(20) NOT NULL DEFAULT 'INHERIT';
ALTER TABLE "domain_categories" ADD COLUMN "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "domain_categories" ADD COLUMN "allowed_user_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- Step 2: Generate temporary codes for existing categories (will be properly set by migration script)
UPDATE "domain_categories"
SET "code" = 'TEMP-' || "id"::TEXT
WHERE "code" IS NULL;

-- Step 3: Make code column NOT NULL and UNIQUE after backfill
ALTER TABLE "domain_categories" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "domain_categories_code_key" ON "domain_categories"("code");

-- Step 4: Add placement_code column to document_placements
ALTER TABLE "document_placements" ADD COLUMN "placement_code" VARCHAR(100);
CREATE UNIQUE INDEX "document_placements_placement_code_key" ON "document_placements"("placement_code");
