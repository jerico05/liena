ALTER TYPE "provider_status" ADD VALUE IF NOT EXISTS 'APPROVED';

ALTER TABLE "provider_profiles"
    DROP CONSTRAINT IF EXISTS "provider_profiles_verified_at_check";

ALTER TABLE "provider_profiles"
    ADD CONSTRAINT "provider_profiles_verified_at_check"
    CHECK ("status" NOT IN ('VERIFIED', 'APPROVED') OR "verified_at" IS NOT NULL);
