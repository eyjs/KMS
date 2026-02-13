-- document_versions 테이블 + 인덱스 추가 + fileHash unique 제거
-- ============================================================

-- 1. document_versions 테이블
CREATE TABLE IF NOT EXISTS "document_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_major" INTEGER NOT NULL,
    "version_minor" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- 2. document_versions 외래키
ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. document_versions 인덱스
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- 4. documents.file_hash UNIQUE 제거 (버전별 해시 허용)
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_file_hash_key";

-- 5. documents.file_name 인덱스 (duplicate_name ROT 탐지용)
CREATE INDEX IF NOT EXISTS "documents_file_name_idx" ON "documents"("file_name");

-- 6. document_history 복합 인덱스 (감사 로그 필터용)
CREATE INDEX IF NOT EXISTS "document_history_action_created_at_idx" ON "document_history"("action", "created_at");
