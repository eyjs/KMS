-- AlterTable
ALTER TABLE "documents" ADD COLUMN "doc_code" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "documents_doc_code_key" ON "documents"("doc_code");
