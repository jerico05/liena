import assert from "node:assert/strict";
import { test } from "node:test";
import { constantTimeEqual, createOpaqueToken, hashToken } from "../src/modules/admin-auth/security";

test("admin session and invitation tokens are high-entropy opaque values", () => {
  const token = createOpaqueToken();

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashToken(token).length, 64);
  assert.notEqual(hashToken(token), token);
});

test("constant-time comparison accepts only identical tokens", () => {
  assert.equal(constantTimeEqual("csrf-token", "csrf-token"), true);
  assert.equal(constantTimeEqual("csrf-token", "other-token"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
});
