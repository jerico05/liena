ALTER TYPE "notification_type" ADD VALUE 'REQUEST';
ALTER TYPE "notification_type" ADD VALUE 'QUOTE';
ALTER TYPE "notification_type" ADD VALUE 'MISSION';

CREATE TYPE "service_request_status" AS ENUM ('OPEN', 'ACCEPTED', 'CANCELLED');
CREATE TYPE "quote_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "mission_status" AS ENUM ('CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

CREATE TABLE "location_zones" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'TG',
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "location_zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "location_zones_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "location_zones_city_check" CHECK (length(trim("city")) > 0)
);
CREATE UNIQUE INDEX "location_zones_country_code_city_neighborhood_key"
    ON "location_zones"("country_code", "city", "neighborhood");
CREATE INDEX "location_zones_country_code_city_is_active_idx"
    ON "location_zones"("country_code", "city", "is_active");

ALTER TABLE "provider_profiles"
    ADD COLUMN "profession_category_id" UUID,
    ADD COLUMN "location_zone_id" UUID;

WITH single_profession AS (
    SELECT "provider_profile_id", MIN("category_id"::text)::uuid AS "category_id"
    FROM "services"
    GROUP BY "provider_profile_id"
    HAVING COUNT(DISTINCT "category_id") = 1
)
UPDATE "provider_profiles" AS profile
SET "profession_category_id" = single_profession."category_id"
FROM single_profession
JOIN "categories" category ON category."id" = single_profession."category_id"
WHERE profile."id" = single_profession."provider_profile_id"
    AND category."parent_id" IS NOT NULL
    AND category."is_active" = TRUE;

INSERT INTO "location_zones" ("id", "country_code", "city", "neighborhood", "updated_at")
SELECT gen_random_uuid(), upper("country_code"), trim("city"), COALESCE(trim("neighborhood"), ''), CURRENT_TIMESTAMP
FROM "provider_profiles"
GROUP BY upper("country_code"), trim("city"), COALESCE(trim("neighborhood"), '')
ON CONFLICT ("country_code", "city", "neighborhood") DO NOTHING;
UPDATE "provider_profiles" AS profile
SET "location_zone_id" = zone."id"
FROM "location_zones" AS zone
WHERE zone."country_code" = upper(profile."country_code")
    AND zone."city" = trim(profile."city")
    AND zone."neighborhood" = COALESCE(trim(profile."neighborhood"), '');

CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "location_zone_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'TG',
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "requested_starts_at" TIMESTAMPTZ(3),
    "status" "service_request_status" NOT NULL DEFAULT 'OPEN',
    "accepted_quote_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "message" TEXT NOT NULL,
    "estimated_duration_days" INTEGER,
    "valid_until" TIMESTAMPTZ(3),
    "status" "quote_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "location_zones" ("id", "country_code", "city", "neighborhood", "updated_at")
SELECT gen_random_uuid(), upper("country_code"), trim("city"), COALESCE(trim("neighborhood"), ''), CURRENT_TIMESTAMP
FROM "service_requests"
GROUP BY upper("country_code"), trim("city"), COALESCE(trim("neighborhood"), '')
ON CONFLICT ("country_code", "city", "neighborhood") DO NOTHING;
UPDATE "service_requests" AS service_request
SET "location_zone_id" = zone."id"
FROM "location_zones" AS zone
WHERE zone."country_code" = upper(service_request."country_code")
    AND zone."city" = trim(service_request."city")
    AND zone."neighborhood" = COALESCE(trim(service_request."neighborhood"), '');

CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "service_request_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "status" "mission_status" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reviews"
    ALTER COLUMN "booking_id" DROP NOT NULL,
    ADD COLUMN "mission_id" UUID;

CREATE INDEX "provider_profiles_profession_category_id_idx"
    ON "provider_profiles"("profession_category_id");
CREATE INDEX "provider_profiles_location_zone_id_idx"
    ON "provider_profiles"("location_zone_id");
CREATE INDEX "service_requests_client_id_status_created_at_idx"
    ON "service_requests"("client_id", "status", "created_at");
CREATE INDEX "service_requests_category_id_status_city_created_at_idx"
    ON "service_requests"("category_id", "status", "city", "created_at");
CREATE INDEX "service_requests_location_zone_id_status_created_at_idx"
    ON "service_requests"("location_zone_id", "status", "created_at");
CREATE UNIQUE INDEX "service_requests_reference_key" ON "service_requests"("reference");
CREATE UNIQUE INDEX "service_requests_accepted_quote_id_key" ON "service_requests"("accepted_quote_id");
CREATE UNIQUE INDEX "service_requests_id_client_id_key" ON "service_requests"("id", "client_id");
CREATE UNIQUE INDEX "quotes_service_request_id_provider_profile_id_key"
    ON "quotes"("service_request_id", "provider_profile_id");
CREATE UNIQUE INDEX "quotes_id_service_request_id_provider_profile_id_key"
    ON "quotes"("id", "service_request_id", "provider_profile_id");
CREATE INDEX "quotes_provider_profile_id_status_created_at_idx"
    ON "quotes"("provider_profile_id", "status", "created_at");
CREATE UNIQUE INDEX "quotes_one_accepted_per_request_idx"
    ON "quotes"("service_request_id") WHERE "status" = 'ACCEPTED';
CREATE UNIQUE INDEX "missions_service_request_id_key" ON "missions"("service_request_id");
CREATE UNIQUE INDEX "missions_quote_id_key" ON "missions"("quote_id");
CREATE INDEX "missions_client_id_status_created_at_idx"
    ON "missions"("client_id", "status", "created_at");
CREATE INDEX "missions_provider_profile_id_status_created_at_idx"
    ON "missions"("provider_profile_id", "status", "created_at");
CREATE UNIQUE INDEX "missions_service_request_id_client_id_key"
    ON "missions"("service_request_id", "client_id");
CREATE UNIQUE INDEX "missions_quote_id_service_request_id_provider_profile_id_key"
    ON "missions"("quote_id", "service_request_id", "provider_profile_id");
CREATE UNIQUE INDEX "missions_id_client_id_provider_profile_id_key"
    ON "missions"("id", "client_id", "provider_profile_id");
CREATE UNIQUE INDEX "reviews_mission_id_key" ON "reviews"("mission_id");
CREATE UNIQUE INDEX "reviews_mission_id_author_id_provider_profile_id_key"
    ON "reviews"("mission_id", "author_id", "provider_profile_id");
ALTER TABLE "missions"
    ADD CONSTRAINT "missions_provider_slot_exclusion"
    EXCLUDE USING gist (
        "provider_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    )
    WHERE (
        "status" IN ('SCHEDULED', 'IN_PROGRESS', 'DISPUTED')
        AND "starts_at" IS NOT NULL
        AND "ends_at" IS NOT NULL
    );

ALTER TABLE "provider_profiles"
    ADD CONSTRAINT "provider_profiles_profession_category_id_fkey"
        FOREIGN KEY ("profession_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "provider_profiles_location_zone_id_fkey"
        FOREIGN KEY ("location_zone_id") REFERENCES "location_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "service_requests_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "service_requests_location_zone_id_fkey"
        FOREIGN KEY ("location_zone_id") REFERENCES "location_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "service_requests_accepted_quote_id_fkey"
        FOREIGN KEY ("accepted_quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_service_request_id_fkey"
        FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "quotes_provider_profile_id_fkey"
        FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "missions"
    ADD CONSTRAINT "missions_service_request_id_client_id_fkey"
        FOREIGN KEY ("service_request_id", "client_id") REFERENCES "service_requests"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "missions_quote_id_service_request_id_provider_profile_id_fkey"
        FOREIGN KEY ("quote_id", "service_request_id", "provider_profile_id") REFERENCES "quotes"("id", "service_request_id", "provider_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "missions_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "missions_provider_profile_id_fkey"
        FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_mission_id_author_id_provider_profile_id_fkey"
        FOREIGN KEY ("mission_id", "author_id", "provider_profile_id") REFERENCES "missions"("id", "client_id", "provider_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "reviews_exactly_one_completed_source_check"
        CHECK (num_nonnulls("booking_id", "mission_id") = 1);

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_accepted_quote_state_check"
        CHECK (("status" = 'ACCEPTED') = ("accepted_quote_id" IS NOT NULL));
ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_amount_check" CHECK ("amount" >= 0),
    ADD CONSTRAINT "quotes_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "quotes_duration_check"
        CHECK ("estimated_duration_days" IS NULL OR "estimated_duration_days" > 0);
ALTER TABLE "missions"
    ADD CONSTRAINT "missions_time_range_check"
        CHECK (("starts_at" IS NULL AND "ends_at" IS NULL) OR
            ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "starts_at" < "ends_at")),
    ADD CONSTRAINT "missions_completed_timestamp_check"
        CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
    ADD CONSTRAINT "missions_cancelled_timestamp_check"
        CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)),
    ADD CONSTRAINT "missions_started_timestamp_check"
        CHECK (("status" IN ('IN_PROGRESS', 'COMPLETED', 'DISPUTED')) = ("started_at" IS NOT NULL)),
    ADD CONSTRAINT "missions_scheduled_slot_required_check"
        CHECK ("status" NOT IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED') OR
            ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL));

CREATE FUNCTION liena_guard_profession_category() RETURNS trigger AS $$
BEGIN
    IF NEW."profession_category_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "categories" category
        WHERE category."id" = NEW."profession_category_id"
          AND category."is_active" = TRUE
          AND category."parent_id" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'provider profession must be an active trade category'
            USING ERRCODE = '23514', CONSTRAINT = 'provider_profiles_profession_category_check';
    END IF;
    IF NEW."profession_category_id" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "services" service
        WHERE service."provider_profile_id" = NEW."id"
          AND service."category_id" <> NEW."profession_category_id"
    ) THEN
        RAISE EXCEPTION 'provider profession conflicts with existing services'
            USING ERRCODE = '23514', CONSTRAINT = 'provider_profiles_profession_services_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_profiles_guard_profession_category"
    BEFORE INSERT OR UPDATE OF "profession_category_id" ON "provider_profiles"
    FOR EACH ROW EXECUTE FUNCTION liena_guard_profession_category();

CREATE FUNCTION liena_guard_service_profession_category() RETURNS trigger AS $$
DECLARE profession_id UUID;
BEGIN
    SELECT "profession_category_id" INTO profession_id
    FROM "provider_profiles" WHERE "id" = NEW."provider_profile_id";
    IF profession_id IS NULL THEN
        UPDATE "provider_profiles"
        SET "profession_category_id" = NEW."category_id"
        WHERE "id" = NEW."provider_profile_id" AND "profession_category_id" IS NULL;
        SELECT "profession_category_id" INTO profession_id
        FROM "provider_profiles" WHERE "id" = NEW."provider_profile_id";
    END IF;
    IF profession_id IS NOT NULL AND profession_id <> NEW."category_id" THEN
        RAISE EXCEPTION 'service category must match provider profession'
            USING ERRCODE = '23514', CONSTRAINT = 'services_provider_profession_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "services_guard_profession_category"
    BEFORE INSERT OR UPDATE OF "provider_profile_id", "category_id" ON "services"
    FOR EACH ROW EXECUTE FUNCTION liena_guard_service_profession_category();

CREATE FUNCTION liena_guard_request_quote_acceptance() RETURNS trigger AS $$
DECLARE
    request_id UUID;
    selected_quote_id UUID;
    selected_quote_request_id UUID;
    selected_quote_status "quote_status";
BEGIN
    IF TG_TABLE_NAME = 'service_requests' THEN
        request_id := NEW."id";
        selected_quote_id := NEW."accepted_quote_id";
    ELSE
        request_id := NEW."service_request_id";
        selected_quote_id := NULL;
    END IF;

    IF TG_TABLE_NAME = 'service_requests' AND selected_quote_id IS NOT NULL THEN
        SELECT "service_request_id", "status" INTO selected_quote_request_id, selected_quote_status
        FROM "quotes" WHERE "id" = selected_quote_id;
        IF selected_quote_request_id IS DISTINCT FROM request_id OR selected_quote_status <> 'ACCEPTED' THEN
            RAISE EXCEPTION 'accepted quote must belong to the request and be accepted'
                USING ERRCODE = '23514', CONSTRAINT = 'service_requests_accepted_quote_check';
        END IF;
    ELSIF TG_TABLE_NAME = 'quotes' AND NEW."status" = 'ACCEPTED' THEN
        IF NOT EXISTS (
            SELECT 1 FROM "service_requests"
            WHERE "id" = request_id AND "accepted_quote_id" = NEW."id" AND "status" = 'ACCEPTED'
        ) THEN
            RAISE EXCEPTION 'accepted quote must be selected by its request'
                USING ERRCODE = '23514', CONSTRAINT = 'quotes_accepted_request_check';
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "service_requests_guard_accepted_quote"
    AFTER INSERT OR UPDATE OF "status", "accepted_quote_id" ON "service_requests"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION liena_guard_request_quote_acceptance();
CREATE CONSTRAINT TRIGGER "quotes_guard_accepted_request"
    AFTER INSERT OR UPDATE OF "status" ON "quotes"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION liena_guard_request_quote_acceptance();

CREATE FUNCTION liena_guard_mission_transition() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (
            SELECT 1 FROM "service_requests" request
            WHERE request."id" = NEW."service_request_id"
              AND request."client_id" = NEW."client_id"
              AND request."status" = 'ACCEPTED'
              AND request."accepted_quote_id" = NEW."quote_id"
        ) THEN
            RAISE EXCEPTION 'mission must reference the accepted quote'
                USING ERRCODE = '23514', CONSTRAINT = 'missions_accepted_quote_check';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
        (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('SCHEDULED', 'CANCELLED'))
        OR (OLD."status" = 'SCHEDULED' AND NEW."status" IN ('IN_PROGRESS', 'CANCELLED'))
        OR (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('COMPLETED', 'DISPUTED'))
        OR (OLD."status" = 'DISPUTED' AND NEW."status" IN ('COMPLETED', 'CANCELLED'))
    ) THEN
        RAISE EXCEPTION 'missions_status_transition_check: invalid transition % -> %', OLD."status", NEW."status"
            USING ERRCODE = '23514', CONSTRAINT = 'missions_status_transition_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "missions_guard_transition"
    BEFORE INSERT OR UPDATE OF "status" ON "missions"
    FOR EACH ROW EXECUTE FUNCTION liena_guard_mission_transition();

CREATE OR REPLACE FUNCTION liena_require_completed_booking_for_review() RETURNS trigger AS $$
BEGIN
    IF NEW."booking_id" IS NOT NULL AND NEW."mission_id" IS NULL AND EXISTS (
        SELECT 1 FROM "bookings"
        WHERE "id" = NEW."booking_id"
          AND "client_id" = NEW."author_id"
          AND "provider_profile_id" = NEW."provider_profile_id"
          AND "status" = 'COMPLETED'
    ) THEN
        RETURN NEW;
    END IF;
    IF NEW."mission_id" IS NOT NULL AND NEW."booking_id" IS NULL AND EXISTS (
        SELECT 1 FROM "missions"
        WHERE "id" = NEW."mission_id"
          AND "client_id" = NEW."author_id"
          AND "provider_profile_id" = NEW."provider_profile_id"
          AND "status" = 'COMPLETED'
    ) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A review requires the author''s completed booking or mission'
        USING ERRCODE = '23514', CONSTRAINT = 'reviews_completed_booking_check';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "reviews_require_completed_booking" ON "reviews";
CREATE TRIGGER "reviews_require_completed_booking"
    BEFORE INSERT OR UPDATE OF "booking_id", "mission_id", "author_id", "provider_profile_id" ON "reviews"
    FOR EACH ROW EXECUTE FUNCTION liena_require_completed_booking_for_review();