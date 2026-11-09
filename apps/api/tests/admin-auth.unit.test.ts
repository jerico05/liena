import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseEnvironment } from "../src/config/env";
import { credentialsMatch } from "../src/modules/admin/admin-auth.security";
import { digestEqual } from "../src/modules/admin/security-tokens";

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

  test("empty optional Yeria settings are treated as unset", () => {
    const config = parseEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/liena_dev?schema=public",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "liena-admin-dev",
      YERIA_APP_ID: "",
      YERIA_SERVICE_ID: "",
    });
    assert.equal(config.YERIA_APP_ID, undefined);
    assert.equal(config.YERIA_SERVICE_ID, undefined);
  });

  test("credentialsMatch compares hashed administrator secrets", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "liena-admin-dev";
    assert.equal(credentialsMatch("admin", "liena-admin-dev"), true);
    assert.equal(credentialsMatch("admin", "wrong"), false);
    assert.equal(digestEqual("admin", "admin"), true);
  });
});
