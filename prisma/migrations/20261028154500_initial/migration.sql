-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CLIENT', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "provider_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "service_status" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "pricing_type" AS ENUM ('FIXED', 'HOURLY', 'DAILY', 'QUOTE');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "payment_operation_type" AS ENUM ('AUTHORIZE', 'CAPTURE', 'REFUND', 'VOID', 'FAILURE');

-- CreateEnum
CREATE TYPE "payment_operation_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('BOOKING', 'PAYMENT', 'MESSAGE', 'REVIEW', 'SYSTEM', 'REMINDER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "report_target_type" AS ENUM ('USER', 'SERVICE', 'REVIEW', 'MESSAGE');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "roles" "user_role"[] DEFAULT ARRAY['CLIENT']::"user_role"[],
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(3),
    "phone_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "provider_status" NOT NULL DEFAULT 'PENDING',
    "verification_notes" TEXT,
    "verified_at" TIMESTAMPTZ(3),
    "country_code" CHAR(2) NOT NULL DEFAULT 'TG',
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "time_zone" TEXT NOT NULL DEFAULT 'Africa/Lome',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT,
    "recipient" TEXT,
    "phone" TEXT,
    "country_code" CHAR(2) NOT NULL DEFAULT 'TG',
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "street" TEXT,
    "details" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricing_type" "pricing_type" NOT NULL,
    "price" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "duration_minutes" INTEGER,
    "status" "service_status" NOT NULL DEFAULT 'DRAFT',
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "country_code" CHAR(2),
    "city" TEXT,
    "neighborhood" TEXT,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_images" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "starts_at" TIME(0) NOT NULL,
    "ends_at" TIME(0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "address_id" UUID,
    "status" "booking_status" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "requested_starts_at" TIMESTAMPTZ(3) NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "agreed_price" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "pricing_type_snapshot" "pricing_type" NOT NULL,
    "listed_price_snapshot" DECIMAL(12,2),
    "service_currency_snapshot" CHAR(3) NOT NULL,
    "duration_minutes_snapshot" INTEGER,
    "service_title_snapshot" TEXT NOT NULL,
    "service_description_snapshot" TEXT NOT NULL,
    "provider_name_snapshot" TEXT NOT NULL,
    "category_name_snapshot" TEXT NOT NULL,
    "address_country_snapshot" CHAR(2),
    "address_recipient_snapshot" TEXT,
    "address_phone_snapshot" TEXT,
    "address_city_snapshot" TEXT,
    "address_neighborhood_snapshot" TEXT,
    "address_street_snapshot" TEXT,
    "address_details_snapshot" TEXT,
    "address_latitude_snapshot" DECIMAL(9,6),
    "address_longitude_snapshot" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "old_status" "booking_status",
    "new_status" "booking_status" NOT NULL,
    "changed_by_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "booking_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "type" "message_type" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider_name" TEXT,
    "provider_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_operations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" "payment_operation_type" NOT NULL,
    "status" "payment_operation_status" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "idempotency_key" TEXT NOT NULL,
    "provider_reference" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider_name" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "payment_id" UUID,
    "signature_verified_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "processing_error" TEXT,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "response" TEXT,
    "responded_at" TIMESTAMPTZ(3),
    "status" "review_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_profile_id" UUID,
    "service_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "report_target_type" NOT NULL,
    "target_user_id" UUID,
    "target_service_id" UUID,
    "target_review_id" UUID,
    "target_message_id" UUID,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'PENDING',
    "moderator_id" UUID,
    "moderator_notes" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_last_name_first_name_idx" ON "users"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_user_id_key" ON "provider_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_slug_key" ON "provider_profiles"("slug");

-- CreateIndex
CREATE INDEX "provider_profiles_status_country_code_city_neighborhood_idx" ON "provider_profiles"("status", "country_code", "city", "neighborhood");

-- CreateIndex
CREATE INDEX "addresses_user_id_is_default_idx" ON "addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "addresses_country_code_city_neighborhood_idx" ON "addresses"("country_code", "city", "neighborhood");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_is_active_position_idx" ON "categories"("parent_id", "is_active", "position");

-- CreateIndex
CREATE INDEX "services_category_id_status_created_at_idx" ON "services"("category_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "services_provider_profile_id_status_idx" ON "services"("provider_profile_id", "status");

-- CreateIndex
CREATE INDEX "services_country_code_city_neighborhood_status_idx" ON "services"("country_code", "city", "neighborhood", "status");

-- CreateIndex
CREATE INDEX "services_status_created_at_idx" ON "services"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "services_provider_profile_id_slug_key" ON "services"("provider_profile_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_provider_profile_id_key" ON "services"("id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "service_images_service_id_position_idx" ON "service_images"("service_id", "position");

-- CreateIndex
CREATE INDEX "availability_slots_provider_profile_id_day_of_week_idx" ON "availability_slots"("provider_profile_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_exceptions_provider_profile_id_starts_at_ends__idx" ON "availability_exceptions"("provider_profile_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_client_id_status_created_at_idx" ON "bookings"("client_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_provider_profile_id_status_created_at_idx" ON "bookings"("provider_profile_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_service_id_starts_at_idx" ON "bookings"("service_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_status_starts_at_idx" ON "bookings"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_id_client_id_provider_profile_id_key" ON "bookings"("id", "client_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_client_id_updated_at_idx" ON "conversations"("client_id", "updated_at");

-- CreateIndex
CREATE INDEX "conversations_provider_profile_id_updated_at_idx" ON "conversations"("provider_profile_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_client_id_provider_profile_id_key" ON "conversations"("client_id", "provider_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_booking_id_client_id_provider_profile_id_key" ON "conversations"("booking_id", "client_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_last_read_at_idx" ON "conversation_participants"("user_id", "last_read_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_status_idx" ON "payments"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operations_idempotency_key_key" ON "payment_operations"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operations_provider_reference_key" ON "payment_operations"("provider_reference");

-- CreateIndex
CREATE INDEX "payment_operations_payment_id_type_status_idx" ON "payment_operations"("payment_id", "type", "status");

-- CreateIndex
CREATE INDEX "payment_webhook_events_payment_id_received_at_idx" ON "payment_webhook_events"("payment_id", "received_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processed_at_received_at_idx" ON "payment_webhook_events"("processed_at", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_name_provider_event_id_key" ON "payment_webhook_events"("provider_name", "provider_event_id");

-- CreateIndex
CREATE INDEX "reviews_provider_profile_id_status_created_at_idx" ON "reviews"("provider_profile_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reviews_author_id_created_at_idx" ON "reviews"("author_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_author_id_provider_profile_id_key" ON "reviews"("booking_id", "author_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_provider_profile_id_key" ON "favorites"("user_id", "provider_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_service_id_key" ON "favorites"("user_id", "service_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_images" ADD CONSTRAINT "service_images_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_provider_profile_id_fkey" FOREIGN KEY ("service_id", "provider_profile_id") REFERENCES "services"("id", "provider_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_client_id_provider_profile_id_fkey" FOREIGN KEY ("booking_id", "client_id", "provider_profile_id") REFERENCES "bookings"("id", "client_id", "provider_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_sender_id_fkey" FOREIGN KEY ("conversation_id", "sender_id") REFERENCES "conversation_participants"("conversation_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_operations" ADD CONSTRAINT "payment_operations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_author_id_provider_profile_id_fkey" FOREIGN KEY ("booking_id", "author_id", "provider_profile_id") REFERENCES "bookings"("id", "client_id", "provider_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_service_id_fkey" FOREIGN KEY ("target_service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_review_id_fkey" FOREIGN KEY ("target_review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_message_id_fkey" FOREIGN KEY ("target_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom PostgreSQL constraints complementing the Prisma schema.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

ALTER TABLE "users"
    ADD CONSTRAINT "users_roles_nonempty_check" CHECK (cardinality("roles") > 0),
    ADD CONSTRAINT "users_deleted_state_check"
        CHECK (("status" = 'DELETED' AND "deleted_at" IS NOT NULL)
            OR ("status" <> 'DELETED' AND "deleted_at" IS NULL));

ALTER TABLE "provider_profiles"
    ADD CONSTRAINT "provider_profiles_verified_at_check"
        CHECK ("status" <> 'VERIFIED' OR "verified_at" IS NOT NULL);

ALTER TABLE "addresses"
    ADD CONSTRAINT "addresses_coordinates_check"
        CHECK (
            ("latitude" IS NULL AND "longitude" IS NULL)
            OR (
                "latitude" BETWEEN -90 AND 90
                AND "longitude" BETWEEN -180 AND 180
            )
        );

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_not_own_parent_check"
        CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "services"
    ADD CONSTRAINT "services_price_check"
        CHECK (
            ("pricing_type" = 'QUOTE' AND "price" IS NULL)
            OR ("pricing_type" <> 'QUOTE' AND "price" IS NOT NULL AND "price" >= 0)
        ),
    ADD CONSTRAINT "services_duration_check"
        CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
    ADD CONSTRAINT "services_currency_check"
        CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "availability_slots"
    ADD CONSTRAINT "availability_slots_day_check"
        CHECK ("day_of_week" BETWEEN 0 AND 6),
    ADD CONSTRAINT "availability_slots_time_check"
        CHECK ("starts_at" < "ends_at");

ALTER TABLE "availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_time_check"
        CHECK ("starts_at" < "ends_at");

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_slot_check"
        CHECK (
            ("starts_at" IS NULL AND "ends_at" IS NULL)
            OR ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "starts_at" < "ends_at")
        ),
    ADD CONSTRAINT "bookings_active_slot_required_check"
        CHECK (
            "status" NOT IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')
            OR ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL)
        ),
    ADD CONSTRAINT "bookings_agreed_price_required_check"
        CHECK (
            "status" NOT IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')
            OR "agreed_price" IS NOT NULL
        ),
    ADD CONSTRAINT "bookings_agreed_price_check"
        CHECK ("agreed_price" IS NULL OR "agreed_price" >= 0),
    ADD CONSTRAINT "bookings_currency_check"
        CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "bookings_service_price_snapshot_check"
        CHECK (
            ("pricing_type_snapshot" = 'QUOTE' AND "listed_price_snapshot" IS NULL)
            OR (
                "pricing_type_snapshot" <> 'QUOTE'
                AND "listed_price_snapshot" IS NOT NULL
                AND "listed_price_snapshot" >= 0
            )
        ),
    ADD CONSTRAINT "bookings_service_currency_snapshot_check"
        CHECK ("service_currency_snapshot" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "bookings_service_duration_snapshot_check"
        CHECK ("duration_minutes_snapshot" IS NULL OR "duration_minutes_snapshot" > 0),
    ADD CONSTRAINT "bookings_completion_timestamp_check"
        CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
    ADD CONSTRAINT "bookings_cancellation_timestamp_check"
        CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)),
    ADD CONSTRAINT "bookings_started_timestamp_check"
        CHECK (
            ("status" IN ('IN_PROGRESS', 'COMPLETED', 'DISPUTED'))
            = ("started_at" IS NOT NULL)
        ),
    ADD CONSTRAINT "bookings_address_coordinates_check"
        CHECK (
            ("address_latitude_snapshot" IS NULL AND "address_longitude_snapshot" IS NULL)
            OR (
                "address_latitude_snapshot" BETWEEN -90 AND 90
                AND "address_longitude_snapshot" BETWEEN -180 AND 180
            )
        );

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_provider_slot_exclusion"
    EXCLUDE USING gist (
        "provider_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    )
    WHERE (
        "status" IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DISPUTED')
        AND "starts_at" IS NOT NULL
        AND "ends_at" IS NOT NULL
    );

ALTER TABLE "availability_slots"
    ADD CONSTRAINT "availability_slots_no_overlap_exclusion"
    EXCLUDE USING gist (
        "provider_profile_id" WITH =,
        "day_of_week" WITH =,
        tsrange(
            TIMESTAMP '2000-01-01' + "starts_at",
            TIMESTAMP '2000-01-01' + "ends_at",
            '[)'
        ) WITH &&
    );

ALTER TABLE "availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_no_overlap_exclusion"
    EXCLUDE USING gist (
        "provider_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    );

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0),
    ADD CONSTRAINT "payments_paid_at_status_check"
        CHECK (
            ("status" IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'))
            = ("paid_at" IS NOT NULL)
        ),
    ADD CONSTRAINT "payments_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "payment_operations"
    ADD CONSTRAINT "payment_operations_amount_check" CHECK ("amount" > 0),
    ADD CONSTRAINT "payment_operations_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_hash_check"
        CHECK ("payload_hash" ~ '^[0-9a-fA-F]{64}$');

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    ADD CONSTRAINT "reviews_response_timestamp_check"
        CHECK (("response" IS NULL) = ("responded_at" IS NULL));

ALTER TABLE "favorites"
    ADD CONSTRAINT "favorites_exactly_one_target_check"
        CHECK (num_nonnulls("provider_profile_id", "service_id") = 1);

ALTER TABLE "message_attachments"
    ADD CONSTRAINT "message_attachments_size_check" CHECK ("byte_size" > 0);

ALTER TABLE "reports"
    ADD CONSTRAINT "reports_target_matches_type_check"
        CHECK (
            ("target_type" = 'USER'
                AND "target_user_id" IS NOT NULL
                AND "target_service_id" IS NULL
                AND "target_review_id" IS NULL
                AND "target_message_id" IS NULL)
            OR ("target_type" = 'SERVICE'
                AND "target_user_id" IS NULL
                AND "target_service_id" IS NOT NULL
                AND "target_review_id" IS NULL
                AND "target_message_id" IS NULL)
            OR ("target_type" = 'REVIEW'
                AND "target_user_id" IS NULL
                AND "target_service_id" IS NULL
                AND "target_review_id" IS NOT NULL
                AND "target_message_id" IS NULL)
            OR ("target_type" = 'MESSAGE'
                AND "target_user_id" IS NULL
                AND "target_service_id" IS NULL
                AND "target_review_id" IS NULL
                AND "target_message_id" IS NOT NULL)
        ),
    ADD CONSTRAINT "reports_resolution_timestamp_check"
        CHECK (
            ("status" IN ('RESOLVED', 'REJECTED') AND "resolved_at" IS NOT NULL)
            OR ("status" IN ('PENDING', 'UNDER_REVIEW') AND "resolved_at" IS NULL)
        );

CREATE FUNCTION liena_guard_booking_status_transition() RETURNS trigger AS $$
BEGIN
    IF NEW."status" IS DISTINCT FROM OLD."status" THEN
        IF NOT (
            (OLD."status" = 'PENDING' AND NEW."status" IN ('ACCEPTED', 'REJECTED', 'CANCELLED'))
            OR (OLD."status" = 'ACCEPTED' AND NEW."status" IN ('SCHEDULED', 'CANCELLED'))
            OR (OLD."status" = 'SCHEDULED' AND NEW."status" IN ('IN_PROGRESS', 'CANCELLED'))
            OR (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('COMPLETED', 'DISPUTED'))
            OR (OLD."status" = 'DISPUTED' AND NEW."status" IN ('COMPLETED', 'CANCELLED'))
        ) THEN
            RAISE EXCEPTION 'bookings_status_transition_check: invalid transition % -> %', OLD."status", NEW."status"
                USING ERRCODE = '23514', CONSTRAINT = 'bookings_status_transition_check';
        END IF;

        INSERT INTO "booking_status_history" (
            "id", "booking_id", "old_status", "new_status", "changed_by_id", "note", "created_at"
        ) VALUES (
            gen_random_uuid(),
            NEW."id",
            OLD."status",
            NEW."status",
            NULLIF(current_setting('app.actor_id', true), '')::uuid,
            NULLIF(current_setting('app.status_note', true), ''),
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bookings_guard_status_transition"
    BEFORE UPDATE OF "status" ON "bookings"
    FOR EACH ROW EXECUTE FUNCTION liena_guard_booking_status_transition();

CREATE FUNCTION liena_record_booking_initial_status() RETURNS trigger AS $$
BEGIN
    INSERT INTO "booking_status_history" (
        "id", "booking_id", "old_status", "new_status", "changed_by_id", "created_at"
    ) VALUES (
        gen_random_uuid(),
        NEW."id",
        NULL,
        NEW."status",
        NULLIF(current_setting('app.actor_id', true), '')::uuid,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bookings_record_initial_status"
    AFTER INSERT ON "bookings"
    FOR EACH ROW EXECUTE FUNCTION liena_record_booking_initial_status();

CREATE FUNCTION liena_guard_booking_address_owner() RETURNS trigger AS $$
BEGIN
    IF NEW."address_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "addresses"
        WHERE "id" = NEW."address_id"
            AND "user_id" = NEW."client_id"
    ) THEN
        RAISE EXCEPTION 'bookings_address_owner_check: address does not belong to booking client'
            USING ERRCODE = '23514', CONSTRAINT = 'bookings_address_owner_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bookings_guard_address_owner"
    BEFORE INSERT OR UPDATE OF "address_id", "client_id" ON "bookings"
    FOR EACH ROW EXECUTE FUNCTION liena_guard_booking_address_owner();

CREATE FUNCTION liena_require_completed_booking_for_review() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "bookings"
        WHERE "id" = NEW."booking_id"
            AND "client_id" = NEW."author_id"
            AND "provider_profile_id" = NEW."provider_profile_id"
            AND "status" = 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'A review requires the author''s completed booking'
            USING ERRCODE = '23514', CONSTRAINT = 'reviews_completed_booking_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reviews_require_completed_booking"
    BEFORE INSERT OR UPDATE OF "booking_id", "author_id", "provider_profile_id" ON "reviews"
    FOR EACH ROW EXECUTE FUNCTION liena_require_completed_booking_for_review();
