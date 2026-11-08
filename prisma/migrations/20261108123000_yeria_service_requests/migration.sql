ALTER TABLE "service_requests"
    ALTER COLUMN "client_id" DROP NOT NULL,
    ADD COLUMN "client_yeria_sub" TEXT,
    ADD COLUMN "provider_profile_id" UUID;

CREATE INDEX "service_requests_client_yeria_sub_status_created_at_idx"
    ON "service_requests"("client_yeria_sub", "status", "created_at");
CREATE INDEX "service_requests_provider_profile_id_status_created_at_idx"
    ON "service_requests"("provider_profile_id", "status", "created_at");

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_provider_profile_id_fkey"
    FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
