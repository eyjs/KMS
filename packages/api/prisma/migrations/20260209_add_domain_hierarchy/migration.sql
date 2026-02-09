-- AlterTable: domain_master에 계층 구조 필드 추가
ALTER TABLE "domain_master" ADD COLUMN "parent_code" VARCHAR(20);
ALTER TABLE "domain_master" ADD COLUMN "description" VARCHAR(500);
ALTER TABLE "domain_master" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "domain_master_parent_code_idx" ON "domain_master"("parent_code");

-- AddForeignKey
ALTER TABLE "domain_master" ADD CONSTRAINT "domain_master_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "domain_master"("code") ON DELETE SET NULL ON UPDATE CASCADE;
