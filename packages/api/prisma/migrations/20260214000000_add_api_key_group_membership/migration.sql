-- CreateTable
CREATE TABLE "api_key_group_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" INTEGER NOT NULL,
    "group_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_group_memberships_api_key_id_idx" ON "api_key_group_memberships"("api_key_id");

-- CreateIndex
CREATE INDEX "api_key_group_memberships_group_id_idx" ON "api_key_group_memberships"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_group_memberships_api_key_id_group_id_key" ON "api_key_group_memberships"("api_key_id", "group_id");

-- AddForeignKey
ALTER TABLE "api_key_group_memberships" ADD CONSTRAINT "api_key_group_memberships_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_group_memberships" ADD CONSTRAINT "api_key_group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
