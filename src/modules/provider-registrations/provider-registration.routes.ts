import { ProviderStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../admin-auth/security";

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

export const providerRegistrationRouter = Router();
providerRegistrationRouter.get("/", requireAdmin, listPendingProviderRegistrations);