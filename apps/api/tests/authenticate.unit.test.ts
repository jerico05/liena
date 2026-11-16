import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Request } from "express";
import { createAuthenticate } from "../src/middlewares/authenticate";

function requestWithAuthorization(authorization?: string) {
  return {
    get(name: string) {
      return name.toLowerCase() === "authorization" ? authorization : undefined;
    },
    user: undefined,
  } as unknown as Request;
}

describe("Yeria authentication middleware", () => {
  test("rejects a missing token", async () => {
    const next = (error?: unknown) => {
      assert.equal((error as { code: string }).code, "AUTHENTICATION_REQUIRED");
    };
    await createAuthenticate(async () => {
      throw new Error("must not verify");
    }, "service-liena")(requestWithAuthorization(), {} as never, next);
  });

  test("rejects an invalid token", async () => {
    const next = (error?: unknown) => {
      assert.equal((error as { code: string }).code, "INVALID_YERIA_TOKEN");
    };
    await createAuthenticate(async () => {
      throw new Error("invalid");
    }, "service-liena")(requestWithAuthorization("Bearer invalid-token"), {} as never, next);
  });

  test("stores verified identity claims", async () => {
    const request = requestWithAuthorization("Bearer verified-token");
    let nextCalled = false;
    await createAuthenticate(async (token, audience) => {
      assert.equal(token, "verified-token");
      assert.equal(audience, "service-liena");
      return {
        sub: "yeria-user-123",
        aud: "service-liena",
        iss: "yeria",
        exp: 2_000_000_000,
        iat: 1_999_999_000,
        kid: "key-1",
      };
    }, "service-liena")(request, {} as never, (error?: unknown) => {
      assert.equal(error, undefined);
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(request.user?.yeriaSub, "yeria-user-123");
    assert.equal(request.user?.audience, "service-liena");
  });
});
