-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'EDITOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: domain_master
CREATE TABLE "domain_master" (
    "code" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "parent_code" VARCHAR(20),
    "description" VARCHAR(500),
    "required_facets" JSONB NOT NULL DEFAULT '[]',
    "ssot_key" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_master_pkey" PRIMARY KEY ("code")
);

-- CreateTable: facet_type_master
CREATE TABLE "facet_type_master" (
    "code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "code_prefix" VARCHAR(5) NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facet_type_master_pkey" PRIMARY KEY ("code")
);

-- CreateTable: facet_master
CREATE TABLE "facet_master" (
    "id" SERIAL NOT NULL,
    "domain" VARCHAR(20),
    "facet_type" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "parent_code" VARCHAR(50),
    "tier" VARCHAR(10),
    "max_age_days" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facet_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable: documents
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doc_code" VARCHAR(30),
    "domain" VARCHAR(20) NOT NULL,
    "lifecycle" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "security_level" VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    "file_path" TEXT,
    "file_name" TEXT,
    "file_type" VARCHAR(10),
    "file_size" BIGINT,
    "version_major" INTEGER NOT NULL DEFAULT 1,
    "version_minor" INTEGER NOT NULL DEFAULT 0,
    "reviewed_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "classification_hash" VARCHAR(64),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "row_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: classifications
CREATE TABLE "classifications" (
    "id" SERIAL NOT NULL,
    "document_id" UUID NOT NULL,
    "facet_type" VARCHAR(50) NOT NULL,
    "facet_value" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: relations
CREATE TABLE "relations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "relation_type" VARCHAR(20) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_history
CREATE TABLE "document_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "changes" JSONB,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(8) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "domain_master_parent_code_idx" ON "domain_master"("parent_code");

-- CreateIndex
CREATE UNIQUE INDEX "facet_master_facet_type_code_key" ON "facet_master"("facet_type", "code");
CREATE INDEX "facet_master_facet_type_idx" ON "facet_master"("facet_type");
CREATE INDEX "facet_master_domain_idx" ON "facet_master"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "documents_doc_code_key" ON "documents"("doc_code");
CREATE INDEX "documents_domain_idx" ON "documents"("domain");
CREATE INDEX "documents_lifecycle_idx" ON "documents"("lifecycle");
CREATE INDEX "documents_security_level_idx" ON "documents"("security_level");
CREATE INDEX "documents_classification_hash_idx" ON "documents"("classification_hash");
CREATE INDEX "documents_is_deleted_idx" ON "documents"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "classifications_document_id_facet_type_key" ON "classifications"("document_id", "facet_type");
CREATE INDEX "classifications_document_id_idx" ON "classifications"("document_id");
CREATE INDEX "classifications_facet_type_facet_value_idx" ON "classifications"("facet_type", "facet_value");

-- CreateIndex
CREATE UNIQUE INDEX "relations_source_id_target_id_relation_type_key" ON "relations"("source_id", "target_id", "relation_type");
CREATE INDEX "relations_source_id_idx" ON "relations"("source_id");
CREATE INDEX "relations_target_id_idx" ON "relations"("target_id");

-- CreateIndex
CREATE INDEX "document_history_document_id_idx" ON "document_history"("document_id");
CREATE INDEX "document_history_created_at_idx" ON "document_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "domain_master" ADD CONSTRAINT "domain_master_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "domain_master"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facet_master" ADD CONSTRAINT "facet_master_domain_fkey" FOREIGN KEY ("domain") REFERENCES "domain_master"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_domain_fkey" FOREIGN KEY ("domain") REFERENCES "domain_master"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relations" ADD CONSTRAINT "relations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_history" ADD CONSTRAINT "document_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_history" ADD CONSTRAINT "document_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
