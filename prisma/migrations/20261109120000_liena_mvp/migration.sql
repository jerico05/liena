-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "provider_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "moderation_decision_type" AS ENUM ('APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE');

-- CreateEnum
CREATE TYPE "service_request_status" AS ENUM ('SENT', 'ACCEPTED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" SERIAL NOT NULL,
    "yeria_sub" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "services" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "indicative_price" DECIMAL(12,2),
    "contact" TEXT NOT NULL,
    "media_refs" JSONB,
    "status" "provider_status" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_decisions" (
    "id" SERIAL NOT NULL,
    "provider_profile_id" INTEGER NOT NULL,
    "admin_username" TEXT NOT NULL,
    "admin_yeria_sub" TEXT,
    "decision" "moderation_decision_type" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" SERIAL NOT NULL,
    "client_yeria_sub" TEXT NOT NULL,
    "provider_profile_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "zone" TEXT,
    "status" "service_request_status" NOT NULL DEFAULT 'SENT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_events" (
    "id" SERIAL NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "actor_yeria_sub" TEXT NOT NULL,
    "old_status" "service_request_status",
    "new_status" "service_request_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_is_active_display_order_idx" ON "categories"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_label_key" ON "categories"("label");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_yeria_sub_key" ON "provider_profiles"("yeria_sub");

-- CreateIndex
CREATE INDEX "provider_profiles_status_is_active_category_id_zone_idx" ON "provider_profiles"("status", "is_active", "category_id", "zone");

-- CreateIndex
CREATE INDEX "provider_profiles_category_id_created_at_idx" ON "provider_profiles"("category_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_decisions_provider_profile_id_created_at_idx" ON "moderation_decisions"("provider_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_decisions_admin_username_created_at_idx" ON "moderation_decisions"("admin_username", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_client_yeria_sub_created_at_idx" ON "service_requests"("client_yeria_sub", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_provider_profile_id_status_created_at_idx" ON "service_requests"("provider_profile_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "request_events_service_request_id_created_at_idx" ON "request_events"("service_request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_events_actor_yeria_sub_created_at_idx" ON "request_events"("actor_yeria_sub", "created_at");

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
