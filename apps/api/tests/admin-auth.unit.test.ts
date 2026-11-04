import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseEnvironment } from "../src/config/env";
import { credentialsMatch } from "../src/services/admin-auth.security";
import { digestEqual } from "../src/utils/security-tokens";

describe("admin auth configuration", () => {
  test("parseEnvironment applies mock defaults in development", () => {
    const config = parseEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/liena_dev?schema=public",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "liena-admin-dev",
    });
    assert.equal(config.ADMIN_MOCK_DATA, true);
    assert.equal(config.PORT, 3000);
  });

  test("credentialsMatch compares hashed administrator secrets", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "liena-admin-dev";
    assert.equal(credentialsMatch("admin", "liena-admin-dev"), true);
    assert.equal(credentialsMatch("admin", "wrong"), false);
    assert.equal(digestEqual("admin", "admin"), true);
  });
});
