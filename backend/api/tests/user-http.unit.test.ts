import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { RequestHandler } from "express";
import { prisma } from "../src/config/database";
import { createApp } from "../src/app";
import { HttpError } from "../src/middlewares/errorHandler";

type TestProfile = Record<string, any> & { id: number; yeriaSub: string; status: string };
type TestRequest = Record<string, any> & { id: number; clientYeriaSub: string; providerProfileId: number; status: string };

const profileBySub = new Map<string, TestProfile>();
const requests: TestRequest[] = [];
const requestEvents: Array<Record<string, any>> = [];
const restorers: Array<() => void> = [];
const category = { id: 1, label: "Plomberie", displayOrder: 1 };
const providerId = 2;
const publicProvider = {
  id: providerId,
  displayName: "Provider Approved",
  categoryId: category.id,
  services: "Réparation",
  zone: "Lomé",
  description: "Description publique",
  indicativePrice: null,
  contact: "contact@example.test",
  status: "APPROVED",
  createdAt: new Date(),
  approvedAt: new Date(),
  category: { label: category.label },
};

const testAuthentication: RequestHandler = (request, _response, next) => {
  const authorization = request.get("authorization");
  if (!authorization) return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Token required."));
  if (authorization === "Bearer invalid-token") return next(new HttpError(401, "INVALID_YERIA_TOKEN", "Invalid token."));
  request.user = {
    yeriaSub: authorization.replace(/^Bearer\s+/i, ""),
    audience: "service-liena",
    issuer: "yeria",
    expiresAt: 2_000_000_000,
  };
  next();
};

function profile(yeriaSub: string): TestProfile {
  return {
    id: 10,
    yeriaSub,
    displayName: "Atelier Test",
    categoryId: category.id,
    category: { label: category.label },
    services: "Réparation",
    zone: "Lomé",
    description: "Description test",
    indicativePrice: null,
    contact: "contact@example.test",
    mediaRefs: null,
    status: "DRAFT",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedAt: null,
  };
}

const app = createApp({ userAuthenticate: testAuthentication });
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

test("Yeria routes use the Jyoss schema and enforce identity ownership", async () => {
  replace(prisma.category, "findMany", async () => [category]);
  replace(prisma.category, "findFirst", async () => ({ id: category.id }));
  replace(prisma.providerProfile, "count", async () => 1);
  replace(prisma.providerProfile, "findMany", async () => [publicProvider]);
  replace(prisma.providerProfile, "findFirst", async (args: any) => {
    if (args.where.yeriaSub) {
      return args.where.yeriaSub === "provider-a" ? { id: providerId } : null;
    }
    if (args.where.id !== providerId) return null;
    return args.select?.category ? publicProvider : { id: providerId };
  });
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
    assert.ok(current);
    const updated = { ...current, ...args.data, updatedAt: new Date() };
    profileBySub.set(args.where.yeriaSub, updated);
    return updated;
  });
  replace(prisma.serviceRequest, "create", async (args: any) => {
    const created: TestRequest = {
      id: requests.length + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    };
    requests.push(created);
    return created;
  });
  replace(prisma.serviceRequest, "findMany", async (args: any) =>
    args.where.clientYeriaSub
      ? requests.filter((item) => item.clientYeriaSub === args.where.clientYeriaSub)
      : requests.filter((item) => item.providerProfileId === args.where.providerProfileId),
  );
  replace(prisma.serviceRequest, "findFirst", async (args: any) =>
    requests.find(
      (item) =>
        item.id === args.where.id &&
        item.providerProfileId === args.where.providerProfileId &&
        (!args.where.status || item.status === args.where.status),
    ) ?? null,
  );
  replace(prisma.serviceRequest, "update", async (args: any) => {
    const current = requests.find((item) => item.id === args.where.id);
    assert.ok(current);
    Object.assign(current, args.data, { updatedAt: new Date() });
    return current;
  });
  replace(prisma.serviceRequest, "updateMany", async (args: any) => {
    const current = requests.find(
      (item) =>
        item.id === args.where.id &&
        item.providerProfileId === args.where.providerProfileId &&
        item.status === args.where.status,
    );
    if (!current) return { count: 0 };
    Object.assign(current, args.data, { updatedAt: new Date() });
    return { count: 1 };
  });
  replace(prisma.serviceRequest, "findUnique", async (args: any) =>
    requests.find((item) => item.id === args.where.id) ?? null,
  );
  replace(prisma.requestEvent, "create", async (args: any) => {
    const event = { id: requestEvents.length + 1, createdAt: new Date(), ...args.data };
    requestEvents.push(event);
    return event;
  });
  replace(prisma, "$transaction", async (callback: any) => callback(prisma));

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
      resolve();
    });
  });

  const categories = await fetch(`${baseUrl}/categories`);
  assert.equal(categories.status, 200);
  assert.equal((await categories.json()).data[0].label, category.label);
  const providers = await fetch(`${baseUrl}/providers`);
  assert.equal(providers.status, 200);
  assert.equal((await providers.json()).data[0].status, "APPROVED");
  assert.equal((await fetch(`${baseUrl}/providers/${providerId}`)).status, 200);

  const profileBody = {
    displayName: "Atelier Test",
    categoryId: category.id,
    services: "Réparation",
    zone: "Lomé",
    description: "Description du prestataire",
    contact: "contact@example.test",
  };
  const createProfile = await fetch(`${baseUrl}/providers/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" },
    body: JSON.stringify(profileBody),
  });
  assert.equal(createProfile.status, 201);
  assert.equal((await createProfile.json()).data.status, "DRAFT");
  assert.equal(
    (await fetch(`${baseUrl}/providers/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" },
      body: JSON.stringify(profileBody),
    })).status,
    409,
  );
  assert.equal(
    (await fetch(`${baseUrl}/providers/profile/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" },
      body: JSON.stringify({ yeriaSub: "other-user" }),
    })).status,
    400,
  );
  assert.equal((await fetch(`${baseUrl}/providers/profile/me`, {
    headers: { Authorization: "Bearer user-a" },
  })).status, 200);
  assert.equal((await fetch(`${baseUrl}/providers/profile/me/submit`, {
    method: "POST",
    headers: { Authorization: "Bearer user-a" },
  })).status, 200);
  assert.equal(profileBySub.get("user-a")?.status, "PENDING");
  assert.equal((await fetch(`${baseUrl}/providers/profile/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer user-a" },
    body: JSON.stringify({ zone: "Kara" }),
  })).status, 409);

  const requestBody = {
    providerProfileId: providerId,
    description: "Une fuite sous l'évier doit être réparée.",
    zone: "Lomé",
    clientContact: "+22890123456",
    location: { lat: 6.1375, lon: 1.2123, accuracy: 25 },
  };
  assert.equal((await fetch(`${baseUrl}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer client-a" },
    body: JSON.stringify(requestBody),
  })).status, 201);
  assert.equal((await fetch(`${baseUrl}/requests`, {
    headers: { Authorization: "Bearer client-a" },
  })).status, 200);
  const otherClientRequests = await fetch(`${baseUrl}/requests/my-requests`, {
    headers: { Authorization: "Bearer other-client" },
  });
  assert.equal((await otherClientRequests.json()).data.length, 0);
  assert.equal((await fetch(`${baseUrl}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })).status, 401);

  assert.equal((await fetch(`${baseUrl}/providers/requests`, {
    headers: { Authorization: "Bearer provider-a" },
  })).status, 200);
  const requestId = requests[0].id;
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/accept`, {
    method: "PATCH",
    headers: { Authorization: "Bearer provider-a" },
  })).status, 200);
  assert.equal(requests[0].status, "ACCEPTED");
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/complete`, {
    method: "PATCH",
    headers: { Authorization: "Bearer provider-a" },
  })).status, 200);
  assert.equal(requests[0].status, "COMPLETED");
  assert.equal(requestEvents.length, 3);
  assert.equal((await fetch(`${baseUrl}/providers/requests/${requestId}/decline`, {
    method: "PATCH",
    headers: { Authorization: "Bearer provider-a" },
  })).status, 409);
});

after(async () => {
  for (const restore of restorers.reverse()) restore();
  await new Promise<void>((resolve, reject) =>
    server?.close((error) => (error ? reject(error) : resolve())),
  );
});

function replace(target: any, key: string, implementation: (...args: any[]) => unknown): void {
  const original = target[key];
  target[key] = implementation;
  restorers.push(() => {
    target[key] = original;
  });
}
