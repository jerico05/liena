-- AlterTable
ALTER TABLE "service_requests"
ADD COLUMN "client_contact" TEXT,
ADD COLUMN "location_lat" DECIMAL(10, 7),
ADD COLUMN "location_lon" DECIMAL(10, 7),
ADD COLUMN "location_accuracy" DECIMAL(10, 2);
