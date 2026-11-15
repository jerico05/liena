-- Alignement formulaire : clientContact obligatoire
UPDATE "service_requests"
SET "client_contact" = 'non-renseigne'
WHERE "client_contact" IS NULL OR btrim("client_contact") = '';

ALTER TABLE "service_requests"
ALTER COLUMN "client_contact" SET NOT NULL;
