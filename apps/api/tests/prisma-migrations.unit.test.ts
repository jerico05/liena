import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const migrationsRoot = path.resolve(__dirname, "../../../prisma/migrations");
const readMigration = (name: string) => fs.readFileSync(path.join(migrationsRoot, name, "migration.sql"), "utf8");

test("pending Prisma migrations preserve historical columns and constraints", () => {
  const providerIdentity = readMigration("20261108120000_yeria_provider_identity");
  assert.match(providerIdentity, /ADD COLUMN "yeria_sub" TEXT/);
  assert.match(providerIdentity, /provider_profiles_yeria_sub_key/);
  assert.match(providerIdentity, /ALTER COLUMN "user_id" DROP NOT NULL/);
  assert.doesNotMatch(providerIdentity, /profession_category_id/);

  const requestEvents = readMigration("20261108140000_request_events_provider_workflow");
  assert.match(requestEvents, /request_events_exactly_one_actor_check/);
  assert.match(requestEvents, /num_nonnulls\("actor_yeria_sub", "actor_user_id"\) = 1/);
  assert.match(requestEvents, /request_events_request_id_fkey.*ON DELETE RESTRICT/s);

  const acceptance = readMigration("20261108141000_service_request_acceptance_identity");
  assert.match(acceptance, /accepted_quote_id.*provider_profile_id/s);

  const superAdmin = readMigration("20261108142000_super_admin_role");
  assert.match(superAdmin, /ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'/);
});
