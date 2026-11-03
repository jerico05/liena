import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { app } from "../src/app";
import { parseEnvironment } from "../src/config/env";
import { csrfCookieName } from "../src/modules/admin-auth/security";

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

after(async () => {
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
});

test("validates environment variables and applies safe defaults", () => {
  const config = parseEnvironment({
    DATABASE_URL: "postgresql://local:local@localhost:5432/liena",
  });

  assert.equal(config.PORT, 3000);
  assert.equal(config.NODE_ENV, "development");
  assert.equal(config.CORS_ORIGIN, "http://localhost:5173");
  assert.equal(config.RESEND_API_KEY, undefined);
  assert.equal(parseEnvironment({
    DATABASE_URL: "postgresql://local:local@localhost:5432/liena",
    RESEND_API_KEY: "",
  }).RESEND_API_KEY, undefined);
});

test("requires HTTPS origins in production configuration", () => {
  assert.throws(() => parseEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://local:local@localhost:5432/liena",
  }), /HTTPS/);
});

test("rejects a non-PostgreSQL database URL without echoing credentials", () => {
  assert.throws(
    () => parseEnvironment({ DATABASE_URL: "mysql://local:secret@localhost/liena" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DATABASE_URL/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    },
  );
});

test("rejects service searches with invalid pagination", async () => {
  const response = await fetch(`${baseUrl}/api/v1/services/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageSize: 500 }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal(response.headers.get("x-request-id"), body.requestId);
});

test("validates category route parameters before querying the database", async () => {
  const response = await fetch(`${baseUrl}/api/v1/categories/not-a-valid-slug%20`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("returns a structured error for malformed JSON", async () => {
  const response = await fetch(`${baseUrl}/api/v1/services/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_JSON");
});

test("returns a structured 404 for an unknown route", async () => {
  const response = await fetch(`${baseUrl}/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
});

test("issues an anti-CSRF token for the admin browser client", async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/csrf`);
  const body = await response.json();
  const cookies = response.headers.get("set-cookie") ?? "";

  assert.equal(response.status, 200);
  assert.match(body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(cookies, new RegExp(`${csrfCookieName}=${body.csrfToken}`));
  assert.doesNotMatch(cookies, /HttpOnly/i);
});

test("requires admin authentication to list pending provider registrations", async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/provider-registrations`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("requires admin authentication to approve provider registrations", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/admin/provider-registrations/00000000-0000-4000-8000-000000000001/approve`,
    { method: "PATCH" },
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("returns the active catalog categories", async () => {
  const response = await fetch(`${baseUrl}/api/v1/categories`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.every((item: { slug: string }) => typeof item.slug === "string"));
});

test("supports direct prestation search by keyword", async () => {
  const response = await fetch(`${baseUrl}/api/v1/services/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: "nattes", page: 1, pageSize: 10 }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.pagination.page === 1);
});

test("returns a provider profile detail for verified providers", async () => {
  const response = await fetch(`${baseUrl}/api/v1/providers/test-provider`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "PROVIDER_NOT_FOUND");
});

test("rejects state-changing admin requests without the trusted origin", async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "example password" }),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "CSRF_REJECTED");
});

test("rejects admin requests with a trusted origin but no CSRF token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({ email: "admin@example.com", password: "example password" }),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "CSRF_REJECTED");
});
