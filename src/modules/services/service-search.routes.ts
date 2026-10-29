import { Prisma, ProviderStatus, ServiceStatus, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { validateBody } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";

const serviceSearchSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    city: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

type ServiceSearchInput = z.output<typeof serviceSearchSchema>;

const searchServices: RequestHandler<Record<string, string>, unknown, ServiceSearchInput> = async (
  request,
  response,
) => {
  const { categoryId, city, page, pageSize } = request.body;
  const where: Prisma.ServiceWhereInput = {
    status: ServiceStatus.PUBLISHED,
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    category: { is: { isActive: true } },
    providerProfile: {
      is: {
        status: ProviderStatus.VERIFIED,
        user: { is: { status: UserStatus.ACTIVE } },
      },
    },
  };

  const services = await prisma.service.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
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
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { imageUrl: true, altText: true },
      },
      category: { select: { name: true, slug: true } },
      providerProfile: {
        select: {
          businessName: true,
          slug: true,
          city: true,
          neighborhood: true,
        },
      },
    },
  });

  response.status(200).json({
    data: services,
    pagination: { page, pageSize, returned: services.length },
  });
};

export const serviceSearchRouter = Router();
serviceSearchRouter.post("/search", validateBody(serviceSearchSchema), searchServices);
