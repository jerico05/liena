-- This feature removal intentionally deletes payment records and payment notifications.
DELETE FROM "notifications"
WHERE "type" = 'PAYMENT';

DROP TABLE "payment_webhook_events";
DROP TABLE "payment_operations";
DROP TABLE "payments";

CREATE TYPE "notification_type_without_payment" AS ENUM (
    'BOOKING',
    'MESSAGE',
    'REVIEW',
    'SYSTEM',
    'REMINDER'
);

ALTER TABLE "notifications"
    ALTER COLUMN "type" TYPE "notification_type_without_payment"
    USING ("type"::text::"notification_type_without_payment");

DROP TYPE "notification_type";
ALTER TYPE "notification_type_without_payment" RENAME TO "notification_type";

DROP TYPE "payment_operation_status";
DROP TYPE "payment_operation_type";
DROP TYPE "payment_method";
DROP TYPE "payment_status";
