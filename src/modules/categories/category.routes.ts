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
        },
      },
    },
  });

  if (!category) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
  }

  response.status(200).json({ data: category });
};

export const categoryRouter = Router();
categoryRouter.get("/:slug", validateParams(categoryParamsSchema), getCategory);
