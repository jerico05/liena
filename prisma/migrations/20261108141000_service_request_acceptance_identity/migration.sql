-- Preserve the historical quote-based acceptance rule while allowing the MVP
-- provider workflow to accept a request directly through provider_profile_id.
ALTER TABLE "service_requests"
    DROP CONSTRAINT IF EXISTS "service_requests_accepted_quote_state_check";

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_accepted_quote_state_check"
    CHECK (
        ("status" <> 'ACCEPTED' AND "accepted_quote_id" IS NULL)
        OR
        ("status" = 'ACCEPTED' AND ("accepted_quote_id" IS NOT NULL OR "provider_profile_id" IS NOT NULL))
    );
