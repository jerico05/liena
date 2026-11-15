-- AlterTable
ALTER TABLE "provider_profiles"
ADD COLUMN "location_lat" DECIMAL(10, 7),
ADD COLUMN "location_lon" DECIMAL(10, 7),
ADD COLUMN "location_accuracy" DECIMAL(10, 2);
