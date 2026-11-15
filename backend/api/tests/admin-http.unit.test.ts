import assert from "node:assert/strict";
import type { Server } from "node:http";
import { describe, test, after } from "node:test";
import { createApp } from "../src/app";

const origin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

function mergeCookies(jar: Map<string, string>, response: Response): void {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const line of lines) {
    const [pair] = line.split(";");
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1);
    if (!value) jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
}

describe("admin HTTP surface", () => {
  let server: Server;
  let baseUrl: string;
  const jar = new Map<string, string>();

  test("boots test server", async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        assert.ok(address && typeof address === "object");
        baseUrl = `http://127.0.0.1:${address.port}/api/v1/admin`;
        resolve();
      });
    });
  });

  test("csrf + login + dashboard", async () => {
    const csrfResponse = await fetch(`${baseUrl}/csrf`, { headers: { Origin: origin } });
    assert.equal(csrfResponse.status, 200);
    mergeCookies(jar, csrfResponse);
    const csrfBody = (await csrfResponse.json()) as { csrfToken: string };
    assert.ok(csrfBody.csrfToken);

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfBody.csrfToken,
        Cookie: cookieHeader(jar),
      },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        rememberDevice: false,
      }),
    });
    assert.equal(loginResponse.status, 200);
    mergeCookies(jar, loginResponse);

    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: cookieHeader(jar), Origin: origin },
    });
    assert.equal(dashboardResponse.status, 200);
    const dashboard = (await dashboardResponse.json()) as { data: { summary: unknown } };
    assert.ok(dashboard.data.summary);

    const providersResponse = await fetch(`${baseUrl}/providers?page=1&pageSize=10`, {
      headers: { Cookie: cookieHeader(jar), Origin: origin },
    });
    assert.equal(providersResponse.status, 200);
    const providers = (await providersResponse.json()) as { data: unknown[]; summary: unknown };
    assert.ok(Array.isArray(providers.data));
    assert.ok(providers.summary);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
});
