-- CreateTable
CREATE TABLE "relation_type_master" (
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "label_ko" VARCHAR(50) NOT NULL,
    "inverse_code" VARCHAR(30),
    "is_bidirectional" BOOLEAN NOT NULL DEFAULT false,
    "requires_domain" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relation_type_master_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "relation_properties" (
    "id" UUID NOT NULL,
    "relation_id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "relation_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relation_properties_relation_id_idx" ON "relation_properties"("relation_id");

-- CreateIndex
CREATE UNIQUE INDEX "relation_properties_relation_id_key_key" ON "relation_properties"("relation_id", "key");

-- AddForeignKey
ALTER TABLE "relation_type_master" ADD CONSTRAINT "relation_type_master_inverse_code_fkey" FOREIGN KEY ("inverse_code") REFERENCES "relation_type_master"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relation_properties" ADD CONSTRAINT "relation_properties_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "relations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
