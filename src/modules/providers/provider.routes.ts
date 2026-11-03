import { ProviderStatus, ServiceStatus, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";

const providerSlugSchema = z
  .object({
    slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

type ProviderSlugParams = z.output<typeof providerSlugSchema>;

const getProviderBySlug: RequestHandler<ProviderSlugParams> = async (request, response) => {
  const provider = await prisma.providerProfile.findFirst({
    where: {
      slug: request.params.slug,
      status: ProviderStatus.VERIFIED,
      user: { is: { status: UserStatus.ACTIVE } },
    },
    select: {
      id: true,
      businessName: true,
      slug: true,
      description: true,
      city: true,
      neighborhood: true,
      countryCode: true,
      verifiedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      services: {
        where: {
          status: ServiceStatus.PUBLISHED,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          pricingType: true,
          price: true,
          currency: true,
          durationMinutes: true,
          city: true,
          neighborhood: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!provider) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider profile was not found.");
  }

  response.status(200).json({ data: provider });
};

export const providerRouter = Router();
providerRouter.get("/:slug", validateParams(providerSlugSchema), getProviderBySlug);
