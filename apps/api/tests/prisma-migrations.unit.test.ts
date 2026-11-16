import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const migrationPath = path.resolve(
  __dirname,
  "../../../prisma/migrations/20261109120000_liena_mvp/migration.sql",
);

test("initial migration creates the Jyoss MVP schema", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert.match(migration, /CREATE TABLE "categories"/);
  assert.match(migration, /CREATE TABLE "provider_profiles"/);
  assert.match(migration, /CREATE TABLE "service_requests"/);
  assert.match(migration, /CREATE TABLE "request_events"/);
  assert.match(migration, /'APPROVED'/);
  assert.doesNotMatch(migration, /CREATE TABLE "users"/);
});
