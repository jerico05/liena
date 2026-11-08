-- Additive migration for provider-side request handling and status history.
ALTER TYPE "service_request_status" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "service_request_status" ADD VALUE IF NOT EXISTS 'COMPLETED';

CREATE TABLE IF NOT EXISTS "request_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "from_status" "service_request_status",
    "to_status" "service_request_status" NOT NULL,
    "actor_yeria_sub" TEXT,
    "actor_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "request_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "request_events_exactly_one_actor_check" CHECK (num_nonnulls("actor_yeria_sub", "actor_user_id") = 1)
);

CREATE INDEX IF NOT EXISTS "request_events_request_id_created_at_idx" ON "request_events"("request_id", "created_at");
CREATE INDEX IF NOT EXISTS "request_events_actor_yeria_sub_created_at_idx" ON "request_events"("actor_yeria_sub", "created_at");
