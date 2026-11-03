import { ServiceStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";

const categoryParamsSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

type CategoryParams = z.output<typeof categoryParamsSchema>;

const listCategories: RequestHandler = async (_request, response) => {
  const categories = await prisma.category.findMany({
    where: {
      parentId: null,
      isActive: true,
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
      position: true,
      children: {
        where: { isActive: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          iconUrl: true,
          position: true,
        },
      },
    },
  });

  response.status(200).json({ data: categories });
};

const getCategory: RequestHandler<CategoryParams> = async (request, response) => {
  const category = await prisma.category.findFirst({
    where: {
      slug: request.params.slug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      children: {
        where: { isActive: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          iconUrl: true,
          position: true,
        },
      },
    },
  });

  if (!category) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
  }

  response.status(200).json({ data: category });
};

const getCategoryServices: RequestHandler<CategoryParams> = async (request, response) => {
  const category = await prisma.category.findFirst({
    where: {
      slug: request.params.slug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });

  if (!category) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
  }

  const categoryIds = [category.id];
  if (category.parentId) {
    const childCategoryIds = await prisma.category.findMany({
      where: { parentId: category.id, isActive: true },
      select: { id: true },
    });
    categoryIds.push(...childCategoryIds.map((item) => item.id));
  }

  const services = await prisma.service.findMany({
    where: {
      categoryId: { in: categoryIds },
      status: ServiceStatus.PUBLISHED,
      deletedAt: null,
      providerProfile: {
        is: {
          status: "VERIFIED",
          user: { is: { status: "ACTIVE" } },
        },
      },
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
        select: { id: true, name: true, slug: true },
      },
      providerProfile: {
        select: {
          id: true,
          businessName: true,
          slug: true,
          city: true,
          neighborhood: true,
        },
      },
    },
  });

  response.status(200).json({ data: services, category });
};

export const categoryRouter = Router();
categoryRouter.get("/", listCategories);
categoryRouter.get("/:slug", validateParams(categoryParamsSchema), getCategory);
categoryRouter.get("/:slug/services", validateParams(categoryParamsSchema), getCategoryServices);
