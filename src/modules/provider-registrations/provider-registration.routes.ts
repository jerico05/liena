import { ProviderStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../admin-auth/security";

const providerRegistrationParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();

type ProviderRegistrationParams = z.output<typeof providerRegistrationParamsSchema>;

const listPendingProviderRegistrations: RequestHandler = async (_request, response) => {
  const registrations = await prisma.providerProfile.findMany({
    where: { status: ProviderStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      businessName: true,
      description: true,
      status: true,
      countryCode: true,
      city: true,
      neighborhood: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  response.status(200).json({ data: registrations });
};

const approveProviderRegistration: RequestHandler<ProviderRegistrationParams> = async (
  request,
  response,
) => {
  const verifiedAt = new Date();
  const registration = await prisma.$transaction(async (transaction) => {
    const updateResult = await transaction.providerProfile.updateMany({
      where: {
        id: request.params.id,
        status: ProviderStatus.PENDING,
      },
      data: {
        status: ProviderStatus.VERIFIED,
        verifiedAt,
      },
    });

    if (updateResult.count === 0) {
      const existing = await transaction.providerProfile.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existing) {
        throw new HttpError(
          404,
          "PROVIDER_REGISTRATION_NOT_FOUND",
          "Provider registration was not found.",
        );
      }

      throw new HttpError(
        409,
        "PROVIDER_REGISTRATION_NOT_PENDING",
        "Only pending provider registrations can be approved.",
      );
    }

    const approvedRegistration = await transaction.providerProfile.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        status: true,
        verifiedAt: true,
      },
    });

    if (!approvedRegistration) {
      throw new HttpError(
        404,
        "PROVIDER_REGISTRATION_NOT_FOUND",
        "Provider registration was not found.",
      );
    }

    return approvedRegistration;
  });

  response.status(200).json({ data: registration });
};

export const providerRegistrationRouter = Router();
providerRegistrationRouter.get("/", requireAdmin, listPendingProviderRegistrations);
providerRegistrationRouter.patch(
  "/:id/approve",
  requireAdmin,
  validateParams(providerRegistrationParamsSchema),
  approveProviderRegistration,
);