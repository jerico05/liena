ALTER TABLE "provider_profiles"
    ALTER COLUMN "user_id" DROP NOT NULL,
    ADD COLUMN "yeria_sub" TEXT;

CREATE UNIQUE INDEX "provider_profiles_yeria_sub_key"
    ON "provider_profiles"("yeria_sub");
