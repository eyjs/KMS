-- AlterTable: facet_type_master — 도메인 스코프 추가 (null = 공통/시스템)
ALTER TABLE "facet_type_master" ADD COLUMN IF NOT EXISTS "domain" VARCHAR(20);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "facet_type_master_domain_idx" ON "facet_type_master"("domain");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facet_type_master_domain_fkey'
  ) THEN
    ALTER TABLE "facet_type_master" ADD CONSTRAINT "facet_type_master_domain_fkey"
      FOREIGN KEY ("domain") REFERENCES "domain_master"("code") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
