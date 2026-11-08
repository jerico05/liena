import assert from "node:assert/strict";
import { test, after } from "node:test";
import type { RequestHandler } from "express";
import { prisma } from "../src/config/database";
import { createApp } from "../src/app";
import { HttpError } from "../src/middlewares/errorHandler";

const profileBySub = new Map<string, any>();
const requests: any[] = [];
const requestEvents: any[] = [];
const restorers: Array<() => void> = [];
const category = { id: "11111111-1111-4111-8111-111111111111", parentId: null, name: "Plomberie", slug: "plomberie", description: null, iconUrl: null, position: 1 };
const providerId = "22222222-2222-4222-8222-222222222222";
const publicProvider = { id: providerId, businessName: "Provider Approved", slug: "provider-approved", description: null, status: "APPROVED", countryCode: "TG", city: "Lome", neighborhood: null, timeZone: "Africa/Lome", verifiedAt: new Date(), createdAt: new Date(), professionCategory: null, _count: { services: 0 } };

const testAuthentication: RequestHandler = (request, _response, next) => {
  const authorization = request.get("authorization");
  if (!authorization) return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Token required."));
  if (authorization === "Bearer invalid") return next(new HttpError(401, "INVALID_YERIA_TOKEN", "Invalid token."));
  request.user = { yeriaSub: authorization.replace(/^Bearer\s+/, ""), audience: "service-liena", issuer: "yeria", expiresAt: 2_000_000_000 };
  next();
};

function profile(yeriaSub: string) {
  return { id: `profile-${yeriaSub}`, yeriaSub, businessName: "Atelier Test", slug: `atelier-${yeriaSub}`, description: "Description test", status: "PENDING", verificationNotes: null, countryCode: "TG", city: "Lome", neighborhood: null, timeZone: "Africa/Lome", professionCategoryId: null, verifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
}

const app = createApp({ userAuthenticate: testAuthentication });
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

test("user HTTP routes and identity ownership", async () => {
  replace(prisma.category, "findMany", async () => [category]);
  replace(prisma.category, "findFirst", async () => ({ id: category.id }));
  replace(prisma.providerProfile, "count", async () => 1);
  replace(prisma.providerProfile, "findMany", async (args: any) => {
    assert.deepEqual(args.where.status.in, ["APPROVED", "VERIFIED"]);
    return [publicProvider];
  });
  replace(prisma.providerProfile, "findFirst", async (args: any) => args.where.id === providerId ? { id: providerId } : null);
  replace(prisma.providerProfile, "findUnique", async (args: any) => {
    const sub = args.where.yeriaSub;
    return sub ? profileBySub.get(sub) ?? null : null;
  });
  replace(prisma.providerProfile, "create", async (args: any) => {
    const created = { ...profile(args.data.yeriaSub), ...args.data };
    profileBySub.set(args.data.yeriaSub, created);
    return created;
  });
  replace(prisma.providerProfile, "update", async (args: any) => {
    const current = profileBySub.get(args.where.yeriaSub);
    const updated = { ...current, ...args.data, updatedAt: new Date() };
    profileBySub.set(args.where.yeriaSub, updated);
    return updated;
  });
  replace(prisma.serviceRequest, "create", async (args: any) => {
    const created = { id: `33333333-3333-4333-8333-${String(requests.length + 1).padStart(12, "0")}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
    requests.push(created);
    return created;
  });
  replace(prisma.serviceRequest, "findMany", async (args: any) => args.where.clientYeriaSub
    ? requests.filter((item) => item.clientYeriaSub === args.where.clientYeriaSub)
    : requests.filter((item) => item.providerProfileId === args.where.providerProfileId));
  replace(prisma.serviceRequest, "findFirst", async (args: any) => requests.find((item) => item.id === args.where.id && item.providerProfileId === args.where.providerProfileId && (!args.where.status || item.status === args.where.status)) ?? null);
  replace(prisma.serviceRequest, "update", async (args: any) => {
    const current = requests.find((item) => item.id === args.where.id);
    Object.assign(current, args.data, { updatedAt: new Date() });
    return current;
  });
  replace(prisma.requestEvent, "create", async (args: any) => { const event = { id: `event-${requestEvents.length + 1}`, createdAt: new Date(), ...args.data }; requestEvents.push(event); return event; });
  replace(prisma, "$transaction", async (callback: any) => callback(prisma));

  await new Promise<void>((resolve) => { server = app.listen(0, () => { const address = server.address(); assert.ok(address && typeof address === "object"); baseUrl = `http://127.0.0.1:${address.port}/api/v1`; resolve(); }); });

  const categories = await fetch(`${baseUrl}/categories`);
  assert.equal(categories.status, 200);
  assert.equal((await categories.json()).data.length, 1);
  const providers = await fetch(`${baseUrl}/providers`);
  assert.equal(providers.status, 200);
  assert.equal((await providers.json()).data[0].status, "APPROVED");
  assert.equal((await fetch(`${baseUrl}/providers/`)).status, 200);

  assert.equal((await fetch(`${baseUrl}/providers/profile`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" }, body: JSON.stringify({ businessName: "Atelier Test", city: "Lome" }) })).status, 201);
  assert.equal((await fetch(`${baseUrl}/providers/profile`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" }, body: JSON.stringify({ businessName: "Atelier Test", city: "Lome" }) })).status, 409);
  assert.equal((await fetch(`${baseUrl}/providers/profile`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer user-b" }, body: JSON.stringify({ businessName: "Autre", city: "Lome", yeriaSub: "user-a" }) })).status, 400);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me`, { headers: { Authorization: "Bearer user-a" } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" }, body: JSON.stringify({ city: "Kara" }) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me/submit`, { method: "POST", headers: { Authorization: "Bearer user-a" } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me/status`, { headers: { Authorization: "Bearer user-a" } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer user-b" }, body: JSON.stringify({ city: "Kara" }) })).status, 404);

  const requestBody = { providerProfileId: providerId, categoryId: category.id, title: "Réparer une fuite", description: "Une fuite sous l'évier doit être réparée.", city: "Lome" };
  assert.equal((await fetch(`${baseUrl}/requests`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" }, body: JSON.stringify(requestBody) })).status, 201);
  assert.equal((await fetch(`${baseUrl}/requests`, { headers: { Authorization: "Bearer user-a" } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/requests/my-requests`, { headers: { Authorization: "Bearer user-b" } })).status, 200);
  const otherClientRequests = await fetch(`${baseUrl}/requests/my-requests`, { headers: { Authorization: "Bearer user-b" } });
  assert.equal((await otherClientRequests.json()).data.length, 0);
  assert.equal((await fetch(`${baseUrl}/requests`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer invalid" }, body: JSON.stringify(requestBody) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) })).status, 401);

  replace(prisma.providerProfile, "findFirst", async (args: any) => args.where.yeriaSub === "provider-a" ? { id: providerId } : args.where.id === providerId ? { id: providerId } : null);
  const providerRequests = await fetch(`${baseUrl}/providers/requests`, { headers: { Authorization: "Bearer provider-a" } });
  assert.equal(providerRequests.status, 200);
  assert.equal((await providerRequests.json()).data.length, 1);
  const requestId = requests[0].id;
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/accept`, { method: "PATCH", headers: { Authorization: "Bearer provider-a" } })).status, 200);
  assert.equal(requests[0].status, "ACCEPTED");
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/complete`, { method: "PATCH", headers: { Authorization: "Bearer provider-a" } })).status, 200);
  assert.equal(requests[0].status, "COMPLETED");
  assert.equal(requestEvents.length, 2);
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/decline`, { method: "PATCH", headers: { Authorization: "Bearer provider-a" } })).status, 409);
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}`, { headers: { Authorization: "Bearer provider-b" } })).status, 404);
});

after(async () => {
  for (const restore of restorers.reverse()) restore();
  await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
});

function replace(target: any, key: string, implementation: (...args: any[]) => unknown): void {
  const original = target[key];
  target[key] = implementation;
  restorers.push(() => { target[key] = original; });
}
