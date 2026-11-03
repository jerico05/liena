import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookingStatus,
  MessageType,
  Prisma,
  PrismaClient,
  ProviderStatus,
  ServiceStatus,
  UserRole,
} from "@prisma/client";
import { Pool } from "pg";
import { app } from "../src/app";
import { disconnectDatabase } from "../src/lib/prisma";
import {
  createOpaqueToken,
  csrfCookieName,
  hashToken,
  sessionCookieName,
} from "../src/modules/admin-auth/security";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must be set by scripts/test-database.mjs.");
}

const pool = new Pool({ connectionString: testDatabaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const rollbackSignal = Symbol("rollback test transaction");
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

async function withRollback(
  callback: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  try {
    await prisma.$transaction(async (transaction) => {
      await callback(transaction);
      throw rollbackSignal;
    });
  } catch (error) {
    if (error !== rollbackSignal) {
      throw error;
    }
  }
}

async function assertConstraintFailure(
  operation: Promise<void>,
  constraint: string,
) {
  await assert.rejects(operation, (error: unknown) => {
    const metadata =
      error && typeof error === "object" && "meta" in error
        ? JSON.stringify(error.meta)
        : "";
    const details = `${error instanceof Error ? error.message : String(error)} ${metadata}`;
    assert.ok(details.includes(constraint), details);
    return true;
  });
}

async function createFixture(transaction: Prisma.TransactionClient) {
  const suffix = randomUUID();
  const client = await transaction.user.create({
    data: {
      firstName: "Client",
      lastName: "Test",
      email: `client-${suffix}@example.test`,
      passwordHash: "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      roles: [UserRole.CLIENT],
    },
  });
  const providerUser = await transaction.user.create({
    data: {
      firstName: "Provider",
      lastName: "Test",
      email: `provider-${suffix}@example.test`,
      passwordHash: "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      roles: [UserRole.PROVIDER],
    },
  });
  const providerProfile = await transaction.providerProfile.create({
    data: {
      userId: providerUser.id,
      businessName: "Test services",
      slug: `test-services-${suffix}`,
      status: ProviderStatus.VERIFIED,
      verifiedAt: new Date(),
      city: "Lomé",
    },
  });
  const category = await transaction.category.create({
    data: {
      name: "Test category",
      slug: `test-category-${suffix}`,
    },
  });
  const service = await transaction.service.create({
    data: {
      providerProfileId: providerProfile.id,
      categoryId: category.id,
      title: "Test service",
      slug: `test-service-${suffix}`,
      description: "Service used by database integration tests.",
      pricingType: "FIXED",
      price: "12000.00",
      currency: "XOF",
      status: ServiceStatus.PUBLISHED,
    },
  });

  return { client, providerUser, providerProfile, category, service, suffix };
}

type ProviderRegistrationSeed = {
  status: ProviderStatus;
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  description: string;
  city: string;
  neighborhood: string;
  createdAt: Date;
};

async function withAdminAndProviderRegistrations<T>(
  seeds: ProviderRegistrationSeed[],
  callback: (fixture: {
    cookie: string;
    csrfToken: string;
    registrations: Array<{
      id: string;
      userId: string;
      seed: ProviderRegistrationSeed;
    }>;
  }) => Promise<T>,
): Promise<T> {
  const userIds: string[] = [];
  const profileIds: string[] = [];
  let adminSessionId: string | undefined;

  try {
    const admin = await prisma.user.create({
      data: {
        firstName: "Integration",
        lastName: "Admin",
        email: `provider-review-admin-${randomUUID()}@example.test`,
        passwordHash: "integration-test-password-hash",
        roles: [UserRole.ADMIN],
      },
    });
    userIds.push(admin.id);

    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const session = await prisma.adminSession.create({
      data: {
        userId: admin.id,
        tokenHash: hashToken(sessionToken),
        csrfTokenHash: hashToken(csrfToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    adminSessionId = session.id;

    const registrations = [];
    for (const seed of seeds) {
      const user = await prisma.user.create({
        data: {
          firstName: seed.firstName,
          lastName: seed.lastName,
          email: seed.email,
          passwordHash: "integration-test-password-hash",
          roles: [UserRole.PROVIDER],
        },
      });
      userIds.push(user.id);

      const profile = await prisma.providerProfile.create({
        data: {
          userId: user.id,
          businessName: seed.businessName,
          slug: `provider-${randomUUID()}`,
          description: seed.description,
          status: seed.status,
          verifiedAt: seed.status === ProviderStatus.VERIFIED ? seed.createdAt : null,
          city: seed.city,
          neighborhood: seed.neighborhood,
          createdAt: seed.createdAt,
        },
      });
      profileIds.push(profile.id);
      registrations.push({ id: profile.id, userId: user.id, seed });
    }

    return await callback({
      cookie: `${sessionCookieName}=${encodeURIComponent(sessionToken)}; ${csrfCookieName}=${encodeURIComponent(csrfToken)}`,
      csrfToken,
      registrations,
    });
  } finally {
    if (profileIds.length || userIds.length || adminSessionId) {
      await prisma.$transaction(async (transaction) => {
        if (profileIds.length) {
          await transaction.providerProfile.deleteMany({
            where: { id: { in: profileIds } },
          });
        }
        if (adminSessionId) {
          await transaction.adminSession.deleteMany({
            where: { id: adminSessionId },
          });
        }
        if (userIds.length) {
          await transaction.user.deleteMany({ where: { id: { in: userIds } } });
        }
      });
    }
  }
}

async function createBooking(
  transaction: Prisma.TransactionClient,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  reference = `LIENA-${randomUUID()}`,
  addressId?: string,
) {
  const startsAt = new Date("2030-04-15T10:00:00.000Z");
  const endsAt = new Date("2030-04-15T11:00:00.000Z");

  return transaction.booking.create({
    data: {
      reference,
      clientId: fixture.client.id,
      providerProfileId: fixture.providerProfile.id,
      serviceId: fixture.service.id,
      addressId,
      requestedStartsAt: startsAt,
      startsAt,
      endsAt,
      pricingTypeSnapshot: fixture.service.pricingType,
      listedPriceSnapshot: fixture.service.price,
      serviceCurrencySnapshot: fixture.service.currency,
      durationMinutesSnapshot: fixture.service.durationMinutes,
      serviceTitleSnapshot: fixture.service.title,
      serviceDescriptionSnapshot: fixture.service.description,
      providerNameSnapshot: fixture.providerProfile.businessName,
      categoryNameSnapshot: fixture.category.name,
    },
  });
}

after(async () => {
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  await disconnectDatabase();
  await prisma.$disconnect();
  await pool.end();
});

test("lists pending provider registrations for an authenticated admin", async () => {
  const olderPending = {
    status: ProviderStatus.PENDING,
    firstName: "Awa",
    lastName: "Mensah",
    email: `awa-${randomUUID()}@example.test`,
    businessName: "Awa Services",
    description: "Older pending registration.",
    city: "Lomé",
    neighborhood: "Tokoin",
    createdAt: new Date("2026-01-10T09:00:00.000Z"),
  } satisfies ProviderRegistrationSeed;
  const newerPending = {
    ...olderPending,
    firstName: "Kossi",
    lastName: "Adja",
    email: `kossi-${randomUUID()}@example.test`,
    businessName: "Kossi Repairs",
    createdAt: new Date("2026-01-12T09:00:00.000Z"),
  } satisfies ProviderRegistrationSeed;

  await withAdminAndProviderRegistrations(
    [
      olderPending,
      newerPending,
      {
        ...olderPending,
        status: ProviderStatus.VERIFIED,
        email: `verified-${randomUUID()}@example.test`,
        createdAt: new Date("2026-01-11T09:00:00.000Z"),
      },
      {
        ...olderPending,
        status: ProviderStatus.REJECTED,
        email: `rejected-${randomUUID()}@example.test`,
        createdAt: new Date("2026-01-13T09:00:00.000Z"),
      },
    ],
    async ({ cookie, registrations }) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/provider-registrations`, {
        headers: { cookie },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body.data.map((item: { id: string }) => item.id), [
        registrations[0].id,
        registrations[1].id,
      ]);

      const registration = body.data[0];
      const expectedProfileKeys = [
        "businessName",
        "city",
        "countryCode",
        "createdAt",
        "description",
        "id",
        "neighborhood",
        "status",
        "user",
      ];
      assert.deepEqual(Object.keys(registration).sort(), expectedProfileKeys.sort());
      assert.equal(registration.businessName, olderPending.businessName);
      assert.equal(registration.description, olderPending.description);
      assert.equal(registration.status, ProviderStatus.PENDING);
      assert.equal(registration.countryCode, "TG");
      assert.equal(registration.city, olderPending.city);
      assert.equal(registration.neighborhood, olderPending.neighborhood);
      assert.equal(registration.createdAt, olderPending.createdAt.toISOString());
      assert.deepEqual(Object.keys(registration.user).sort(), [
        "email",
        "firstName",
        "id",
        "lastName",
        "phone",
      ]);
      assert.equal(registration.user.id, registrations[0].userId);
      assert.equal(registration.user.firstName, olderPending.firstName);
      assert.equal(registration.user.lastName, olderPending.lastName);
      assert.equal(registration.user.email, olderPending.email);
      assert.equal(registration.user.phone, null);
      assert.doesNotMatch(JSON.stringify(body), /passwordHash/i);
    },
  );
});

test("returns an empty list when no provider registrations are pending", async () => {
  await withAdminAndProviderRegistrations([], async ({ cookie }) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/provider-registrations`, {
      headers: { cookie },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: [] });
  });
});

test("returns 404 when approving a provider registration that does not exist", async () => {
  await withAdminAndProviderRegistrations([], async ({ cookie, csrfToken }) => {
    const response = await fetch(
      `${baseUrl}/api/v1/admin/provider-registrations/${randomUUID()}/approve`,
      { method: "PATCH", headers: { cookie, "x-csrf-token": csrfToken } },
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "PROVIDER_REGISTRATION_NOT_FOUND");
  });
});

test("rejects approval when a provider registration is not pending", async () => {
  await withAdminAndProviderRegistrations(
    [{
      status: ProviderStatus.REJECTED,
      firstName: "Mina",
      lastName: "Doe",
      email: `rejected-${randomUUID()}@example.test`,
      businessName: "Rejected Provider",
      description: "Already rejected registration.",
      city: "Lomé",
      neighborhood: "Tokoin",
      createdAt: new Date("2026-02-01T09:00:00.000Z"),
    }],
    async ({ cookie, csrfToken, registrations }) => {
      const response = await fetch(
        `${baseUrl}/api/v1/admin/provider-registrations/${registrations[0].id}/approve`,
        { method: "PATCH", headers: { cookie, "x-csrf-token": csrfToken } },
      );
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error.code, "PROVIDER_REGISTRATION_NOT_PENDING");
      const persisted = await prisma.providerProfile.findUniqueOrThrow({
        where: { id: registrations[0].id },
      });
      assert.equal(persisted.status, ProviderStatus.REJECTED);
      assert.equal(persisted.verifiedAt, null);
    },
  );
});

test("approves a pending provider registration and records the verification time", async () => {
  await withAdminAndProviderRegistrations(
    [{
      status: ProviderStatus.PENDING,
      firstName: "Afi",
      lastName: "Mensah",
      email: `pending-${randomUUID()}@example.test`,
      businessName: "Afi Services",
      description: "Pending provider registration.",
      city: "Lomé",
      neighborhood: "Bè",
      createdAt: new Date("2026-02-02T09:00:00.000Z"),
    }],
    async ({ cookie, csrfToken, registrations }) => {
      const startedAt = new Date();
      const response = await fetch(
        `${baseUrl}/api/v1/admin/provider-registrations/${registrations[0].id}/approve`,
        { method: "PATCH", headers: { cookie, "x-csrf-token": csrfToken } },
      );
      const body = await response.json();
      const finishedAt = new Date();

      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(body.data).sort(), ["id", "status", "verifiedAt"]);
      assert.equal(body.data.id, registrations[0].id);
      assert.equal(body.data.status, ProviderStatus.VERIFIED);
      assert.doesNotMatch(JSON.stringify(body), /passwordHash/i);
      assert.ok(typeof body.data.verifiedAt === "string");
      const verifiedAt = new Date(body.data.verifiedAt);
      assert.ok(verifiedAt >= startedAt && verifiedAt <= finishedAt);

      const persisted = await prisma.providerProfile.findUniqueOrThrow({
        where: { id: registrations[0].id },
      });
      assert.equal(persisted.status, ProviderStatus.VERIFIED);
      assert.equal(persisted.verifiedAt?.toISOString(), body.data.verifiedAt);
    },
  );
});

test("allows only one concurrent approval of a pending provider registration", async () => {
  await withAdminAndProviderRegistrations(
    [{
      status: ProviderStatus.PENDING,
      firstName: "Komi",
      lastName: "Doe",
      email: `concurrent-${randomUUID()}@example.test`,
      businessName: "Komi Services",
      description: "Pending provider registration.",
      city: "Lomé",
      neighborhood: "Agoè",
      createdAt: new Date("2026-02-03T09:00:00.000Z"),
    }],
    async ({ cookie, csrfToken, registrations }) => {
      const url = `${baseUrl}/api/v1/admin/provider-registrations/${registrations[0].id}/approve`;
      const responses = await Promise.all([
        fetch(url, { method: "PATCH", headers: { cookie, "x-csrf-token": csrfToken } }),
        fetch(url, { method: "PATCH", headers: { cookie, "x-csrf-token": csrfToken } }),
      ]);
      const bodies = await Promise.all(responses.map((response) => response.json()));

      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409],
      );
      const conflictBody = bodies[responses.findIndex((response) => response.status === 409)];
      assert.equal(conflictBody.error.code, "PROVIDER_REGISTRATION_NOT_PENDING");
    },
  );
});

test("supports the booking, completion, and review flow", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    const booking = await createBooking(transaction, fixture);

    await transaction.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
    });
    await transaction.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.SCHEDULED },
    });
    await transaction.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.IN_PROGRESS, startedAt: new Date() },
    });

    await transaction.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });
    await transaction.review.create({
      data: {
        bookingId: booking.id,
        authorId: fixture.client.id,
        providerProfileId: fixture.providerProfile.id,
        rating: 5,
        comment: "Test review.",
      },
    });

    const historyCount = await transaction.bookingStatusHistory.count({
      where: { bookingId: booking.id },
    });
    assert.equal(historyCount, 5);
  });
});

test("rejects negative service prices and out-of-range review ratings", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transaction.service.create({
        data: {
          providerProfileId: fixture.providerProfile.id,
          categoryId: fixture.category.id,
          title: "Negative price",
          slug: `negative-${fixture.suffix}`,
          description: "Invalid service.",
          pricingType: "FIXED",
          price: "-1.00",
        },
      });
    }),
    "services_price_check",
  );

  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const booking = await createBooking(transaction, fixture);
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
      });
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.SCHEDULED },
      });
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.IN_PROGRESS, startedAt: new Date() },
      });
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
      });
      await transaction.review.create({
        data: {
          bookingId: booking.id,
          authorId: fixture.client.id,
          providerProfileId: fixture.providerProfile.id,
          rating: 6,
        },
      });
    }),
    "reviews_rating_check",
  );
});

test("requires exactly one valid favorite target", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transaction.favorite.create({
        data: { userId: fixture.client.id },
      });
    }),
    "favorites_exactly_one_target_check",
  );
});

test("enforces foreign keys and case-insensitive email uniqueness", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      await transaction.address.create({
        data: {
          userId: randomUUID(),
          city: "Lomé",
        },
      });
    }),
    "addresses_user_id_fkey",
  );

  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transaction.user.create({
        data: {
          firstName: "Duplicate",
          lastName: "Email",
          email: fixture.client.email.toUpperCase(),
          passwordHash: "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      });
    }),
    "users_email_lower_key",
  );
});

test("does not allow a booking to use another user's address", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const address = await transaction.address.create({
        data: {
          userId: fixture.providerUser.id,
          city: "Lomé",
        },
      });
      await createBooking(transaction, fixture, `LIENA-${randomUUID()}`, address.id);
    }),
    "bookings_address_owner_check",
  );
});

test("requires a booking service to belong to the referenced provider", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const otherUser = await transaction.user.create({
        data: {
          firstName: "Other",
          lastName: "Provider",
          email: `other-provider-${fixture.suffix}@example.test`,
          passwordHash: "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          roles: [UserRole.PROVIDER],
        },
      });
      const otherProfile = await transaction.providerProfile.create({
        data: {
          userId: otherUser.id,
          businessName: "Other services",
          slug: `other-services-${fixture.suffix}`,
          status: ProviderStatus.VERIFIED,
          verifiedAt: new Date(),
          city: "Lomé",
        },
      });
      await transaction.booking.create({
        data: {
          reference: `LIENA-${randomUUID()}`,
          clientId: fixture.client.id,
          providerProfileId: otherProfile.id,
          serviceId: fixture.service.id,
          requestedStartsAt: new Date("2030-04-15T10:00:00.000Z"),
          pricingTypeSnapshot: fixture.service.pricingType,
          listedPriceSnapshot: fixture.service.price,
          serviceCurrencySnapshot: fixture.service.currency,
          durationMinutesSnapshot: fixture.service.durationMinutes,
          serviceTitleSnapshot: fixture.service.title,
          serviceDescriptionSnapshot: fixture.service.description,
          providerNameSnapshot: otherProfile.businessName,
          categoryNameSnapshot: fixture.category.name,
        },
      });
    }),
    "bookings_service_id_provider_profile_id_fkey",
  );
});

test("rejects invalid booking transitions and overlapping confirmed slots", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const booking = await createBooking(transaction, fixture);
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.REJECTED },
      });
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.COMPLETED },
      });
    }),
    "bookings_status_transition_check",
  );

  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const firstBooking = await createBooking(transaction, fixture);
      await transaction.booking.update({
        where: { id: firstBooking.id },
        data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
      });
      const secondBooking = await createBooking(transaction, fixture);
      await transaction.booking.update({
        where: { id: secondBooking.id },
        data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
      });
    }),
    "bookings_provider_slot_exclusion",
  );
});

test("serializes simultaneous confirmations of an overlapping slot", async () => {
  const fixture = await prisma.$transaction((transaction) => createFixture(transaction));
  const firstBooking = await prisma.$transaction((transaction) =>
    createBooking(transaction, fixture),
  );
  const secondBooking = await prisma.$transaction((transaction) =>
    createBooking(transaction, fixture),
  );

  try {
    const results = await Promise.allSettled([
      prisma.booking.update({
        where: { id: firstBooking.id },
        data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
      }),
      prisma.booking.update({
        where: { id: secondBooking.id },
        data: { status: BookingStatus.ACCEPTED, agreedPrice: "12000.00" },
      }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const failedResult = results.find((result) => result.status === "rejected");
    assert.ok(failedResult && failedResult.status === "rejected");
    const error = failedResult.reason;
    const metadata =
      error && typeof error === "object" && "meta" in error
        ? JSON.stringify(error.meta)
        : "";
    assert.ok(
      `${error instanceof Error ? error.message : String(error)} ${metadata}`.includes(
        "bookings_provider_slot_exclusion",
      ),
    );
  } finally {
    await prisma.$transaction(async (transaction) => {
      await transaction.bookingStatusHistory.deleteMany({
        where: { bookingId: { in: [firstBooking.id, secondBooking.id] } },
      });
      await transaction.booking.deleteMany({
        where: { id: { in: [firstBooking.id, secondBooking.id] } },
      });
      await transaction.service.delete({ where: { id: fixture.service.id } });
      await transaction.category.delete({ where: { id: fixture.category.id } });
      await transaction.providerProfile.delete({
        where: { id: fixture.providerProfile.id },
      });
      await transaction.user.deleteMany({
        where: { id: { in: [fixture.client.id, fixture.providerUser.id] } },
      });
    });
  }
});

test("prevents non-participants from sending messages", async () => {
  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const outsider = await transaction.user.create({
        data: {
          firstName: "Outsider",
          lastName: "Test",
          email: `outsider-${fixture.suffix}@example.test`,
          passwordHash: "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      });
      const conversation = await transaction.conversation.create({
        data: {
          clientId: fixture.client.id,
          providerProfileId: fixture.providerProfile.id,
          participants: {
            create: { userId: fixture.client.id },
          },
        },
      });
      await transaction.message.create({
        data: {
          conversationId: conversation.id,
          senderId: outsider.id,
          type: MessageType.TEXT,
          content: "This must fail.",
        },
      });
    }),
    "messages_conversation_id_sender_id_fkey",
  );
});

test("keeps the seeded category catalog idempotent", async () => {
  const categories = await prisma.category.findMany({
    where: {
      slug: {
        in: [
          "plomberie",
          "electricite",
          "nettoyage",
          "reparation-entretien",
          "travaux-renovation",
          "beaute-bien-etre",
          "informatique",
          "aide-services-domicile",
        ],
      },
    },
  });
  assert.equal(categories.length, 8);
});

test("removes payment tables and enum values from the migrated schema", async () => {
  const tables = await pool.query<{ tableName: string | null }>(`
    SELECT to_regclass('public.payments') AS "tableName"
    UNION ALL SELECT to_regclass('public.payment_operations')
    UNION ALL SELECT to_regclass('public.payment_webhook_events')
  `);
  assert.deepEqual(tables.rows.map((row) => row.tableName), [null, null, null]);

  const paymentTypes = await pool.query<{ typeName: string }>(`
    SELECT typname AS "typeName"
    FROM pg_type
    WHERE typname IN (
      'payment_status',
      'payment_method',
      'payment_operation_type',
      'payment_operation_status'
    )
  `);
  assert.deepEqual(paymentTypes.rows, []);

  const notificationValues = await pool.query<{ label: string }>(`
    SELECT enumlabel AS label
    FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'notification_type'
  `);
  assert.deepEqual(
    notificationValues.rows.map((row) => row.label),
    ["BOOKING", "MESSAGE", "REVIEW", "SYSTEM", "REMINDER"],
  );
});
