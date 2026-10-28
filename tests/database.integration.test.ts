import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookingStatus,
  MessageType,
  PaymentMethod,
  PaymentOperationType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  ProviderStatus,
  ServiceStatus,
  UserRole,
} from "@prisma/client";
import { Pool } from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must be set by scripts/test-database.mjs.");
}

const pool = new Pool({ connectionString: testDatabaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const rollbackSignal = Symbol("rollback test transaction");

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
  await prisma.$disconnect();
  await pool.end();
});

test("supports the full booking, payment, completion, and review flow", async () => {
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

    const payment = await transaction.payment.create({
      data: {
        bookingId: booking.id,
        amount: "12000.00",
        method: PaymentMethod.MOBILE_MONEY,
        idempotencyKey: `payment-${fixture.suffix}`,
      },
    });
    await transaction.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
    });
    await transaction.paymentOperation.create({
      data: {
        paymentId: payment.id,
        type: PaymentOperationType.CAPTURE,
        status: "SUCCEEDED",
        amount: "12000.00",
        idempotencyKey: `capture-${fixture.suffix}`,
      },
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

test("prevents non-participants from sending messages and de-duplicates payment events", async () => {
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

  await assertConstraintFailure(
    withRollback(async (transaction) => {
      const fixture = await createFixture(transaction);
      const booking = await createBooking(transaction, fixture);
      const payment = await transaction.payment.create({
        data: {
          bookingId: booking.id,
          amount: "12000.00",
          method: PaymentMethod.CARD,
          idempotencyKey: `payment-${fixture.suffix}`,
        },
      });
      const event = {
        providerName: "test-gateway",
        providerEventId: `event-${fixture.suffix}`,
        payloadHash: "a".repeat(64),
        paymentId: payment.id,
      };
      await transaction.paymentWebhookEvent.create({ data: event });
      await transaction.paymentWebhookEvent.create({ data: event });
    }),
    "payment_webhook_events_provider_name_provider_event_id_key",
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
