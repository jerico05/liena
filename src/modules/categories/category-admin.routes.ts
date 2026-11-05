import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../admin-auth/security";

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
const createCategorySchema = z.object({
  parentId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).optional(),
  iconUrl: z.string().url().max(2048).optional(),
  position: z.coerce.number().int().min(0).max(10000).default(0),
}).strict();
const updateCategorySchema = createCategorySchema.partial().extend({
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0);

const listCategories: RequestHandler = async (_request, response) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
    include: { parent: { select: { id: true, name: true, slug: true } }, _count: { select: { children: true, services: true } } },
  });
  response.status(200).json({ data: categories });
};

const createCategory: RequestHandler = async (request, response) => {
  const payload = request.body as z.output<typeof createCategorySchema>;
  if (payload.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: payload.parentId }, select: { id: true, parentId: true, isActive: true } });
    if (!parent || !parent.isActive) throw new HttpError(400, "INVALID_CATEGORY_PARENT", "La catégorie parente n’existe pas ou est inactive.");
    if (parent.parentId !== null) throw new HttpError(400, "CATEGORY_DEPTH_EXCEEDED", "Le catalogue est limité à deux niveaux.");
  }
  const category = await prisma.category.create({
    data: {
      parentId: payload.parentId ?? null,
      name: payload.name,
      slug: payload.slug,
      description: payload.description ?? null,
      iconUrl: payload.iconUrl ?? null,
      position: payload.position,
    },
  });
  response.status(201).json({ data: category });
};

const updateCategory: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const payload = request.body as z.output<typeof updateCategorySchema>;
  const current = await prisma.category.findUnique({ where: { id }, select: { id: true, parentId: true } });
  if (!current) throw new HttpError(404, "CATEGORY_NOT_FOUND", "La catégorie n’existe pas.");
  if (payload.parentId !== undefined) {
    if (payload.parentId === id) throw new HttpError(400, "INVALID_CATEGORY_PARENT", "Une catégorie ne peut pas être son propre parent.");
    if (payload.parentId !== null) {
      const parent = await prisma.category.findUnique({ where: { id: payload.parentId }, select: { id: true, parentId: true, isActive: true } });
      if (!parent || parent.parentId !== null || !parent.isActive) throw new HttpError(400, "INVALID_CATEGORY_PARENT", "Le parent doit être une catégorie racine active.");
    }
    if (current.parentId === null) {
      const childCount = await prisma.category.count({ where: { parentId: id } });
      if (childCount && payload.parentId !== undefined) throw new HttpError(409, "CATEGORY_HAS_CHILDREN", "Une catégorie avec des métiers ne peut pas être déplacée sous une autre catégorie.");
    }
    if (payload.parentId === null && current.parentId !== null) {
      const [serviceCount, providerCount, childCount] = await Promise.all([
        prisma.service.count({ where: { categoryId: id } }),
        prisma.providerProfile.count({ where: { professionCategoryId: id } }),
        prisma.category.count({ where: { parentId: id } }),
      ]);
      if (serviceCount || providerCount || childCount) {
        throw new HttpError(409, "CATEGORY_IN_USE", "Un métier utilisé par un profil ou des prestations ne peut pas devenir une catégorie racine.");
      }
    }
  }
  if (payload.isActive === true && payload.parentId !== null) {
    const parentId = payload.parentId ?? current.parentId;
    if (parentId) {
      const activeParent = await prisma.category.findFirst({ where: { id: parentId, isActive: true, parentId: null }, select: { id: true } });
      if (!activeParent) throw new HttpError(409, "CATEGORY_PARENT_INACTIVE", "Une catégorie métier nécessite une catégorie racine active.");
    }
  }
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(payload.parentId !== undefined ? { parentId: payload.parentId } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.iconUrl !== undefined ? { iconUrl: payload.iconUrl } : {}),
      ...(payload.position !== undefined ? { position: payload.position } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
  });
  response.status(200).json({ data: category });
};

const deactivateCategory: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true, parentId: true, isActive: true } });
  if (!category) throw new HttpError(404, "CATEGORY_NOT_FOUND", "La catégorie n’existe pas.");
  if (!category.parentId) {
    const activeChildren = await prisma.category.count({ where: { parentId: id, isActive: true } });
    if (activeChildren) throw new HttpError(409, "CATEGORY_HAS_ACTIVE_CHILDREN", "Désactivez d’abord les métiers actifs de cette catégorie.");
  }
  const updated = await prisma.category.update({ where: { id }, data: { isActive: false } });
  response.status(200).json({ data: updated });
};

export const categoryAdminRouter = Router();
categoryAdminRouter.get("/", requireAdmin, listCategories);
categoryAdminRouter.post("/", requireAdmin, validateBody(createCategorySchema), createCategory);
categoryAdminRouter.patch("/:id", requireAdmin, validateParams(idParamsSchema), validateBody(updateCategorySchema), updateCategory);
categoryAdminRouter.delete("/:id", requireAdmin, validateParams(idParamsSchema), deactivateCategory);