-- CreateTable
CREATE TABLE "permission_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_folder_access" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "category_id" INTEGER NOT NULL,
    "access_type" VARCHAR(10) NOT NULL,
    "include_children" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_folder_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");

-- CreateIndex
CREATE INDEX "user_group_memberships_user_id_idx" ON "user_group_memberships"("user_id");

-- CreateIndex
CREATE INDEX "user_group_memberships_group_id_idx" ON "user_group_memberships"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_memberships_user_id_group_id_key" ON "user_group_memberships"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "group_folder_access_group_id_idx" ON "group_folder_access"("group_id");

-- CreateIndex
CREATE INDEX "group_folder_access_category_id_idx" ON "group_folder_access"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_folder_access_group_id_category_id_key" ON "group_folder_access"("group_id", "category_id");

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_folder_access" ADD CONSTRAINT "group_folder_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_folder_access" ADD CONSTRAINT "group_folder_access_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "domain_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
