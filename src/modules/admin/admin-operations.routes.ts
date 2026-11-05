import { Prisma, ReportStatus, ReportTargetType, UserRole, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireAdmin, requireSuperAdmin } from "../admin-auth/security";
import { requireRequestUserId, requireUserAuthentication } from "../shared/request-user";

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
const userQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  role: z.enum(["CLIENT", "PROVIDER", "ADMIN", "SUPER_ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
const accountStatusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();
const reportCreateSchema = z.object({
  targetType: z.enum(["USER", "SERVICE", "REVIEW", "MESSAGE"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().max(3000).optional(),
}).strict();
const reportDecisionSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
  moderatorNotes: z.string().trim().max(2000).optional(),
}).strict();
const reportListSchema = z.object({ status: z.enum(["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"]).optional() }).strict();

const listUsers: RequestHandler = async (request, response) => {
  const parsed = userQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Les filtres utilisateur sont invalides.");
  const { q, status, role, page, pageSize } = parsed.data;
  const where: Prisma.UserWhereInput = {
    ...(status ? { status } : {}),
    ...(role ? { roles: { has: role as UserRole } } : {}),
    ...(q ? { OR: [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, roles: true, status: true, createdAt: true, providerProfile: { select: { id: true, status: true, businessName: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  response.status(200).json({ data: users, pagination: { page, pageSize, total } });
};

const updateUserStatus: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const { status } = request.body as z.output<typeof accountStatusSchema>;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, roles: true, status: true } });
  if (!target) throw new HttpError(404, "USER_NOT_FOUND", "Le compte n’existe pas.");
  if (target.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN)) {
    throw new HttpError(409, "USE_ADMIN_ACCESS_MANAGEMENT", "Les accès administrateurs se gèrent depuis le module d’administration dédié.");
  }
  if (target.status === UserStatus.DELETED) throw new HttpError(409, "USER_DELETED", "Un compte supprimé ne peut pas être réactivé.");
  const result = await prisma.user.updateMany({ where: { id, status: target.status }, data: { status } });
  if (!result.count) throw new HttpError(409, "USER_CHANGED", "Le compte a été modifié simultanément.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, updatedAt: true } });
  response.status(200).json({ data: user });
};

const createReport: RequestHandler = async (request, response) => {
  const reporterId = requireRequestUserId(request);
  const payload = request.body as z.output<typeof reportCreateSchema>;
  let targetUserId: string | null = null;
  let targetServiceId: string | null = null;
  let targetReviewId: string | null = null;
  let targetMessageId: string | null = null;
  switch (payload.targetType as ReportTargetType) {
    case ReportTargetType.USER: {
      if (payload.targetId === reporterId) throw new HttpError(400, "INVALID_REPORT_TARGET", "Vous ne pouvez pas signaler votre propre compte.");
      const target = await prisma.user.findUnique({ where: { id: payload.targetId }, select: { id: true } });
      if (!target) throw new HttpError(404, "REPORT_TARGET_NOT_FOUND", "La cible du signalement n’existe pas.");
      targetUserId = target.id;
      break;
    }
    case ReportTargetType.SERVICE: {
      const target = await prisma.service.findUnique({ where: { id: payload.targetId }, select: { id: true } });
      if (!target) throw new HttpError(404, "REPORT_TARGET_NOT_FOUND", "La cible du signalement n’existe pas.");
      targetServiceId = target.id;
      break;
    }
    case ReportTargetType.REVIEW: {
      const target = await prisma.review.findUnique({ where: { id: payload.targetId }, select: { id: true } });
      if (!target) throw new HttpError(404, "REPORT_TARGET_NOT_FOUND", "La cible du signalement n’existe pas.");
      targetReviewId = target.id;
      break;
    }
    case ReportTargetType.MESSAGE: {
      const target = await prisma.message.findUnique({ where: { id: payload.targetId }, select: { id: true, conversation: { select: { participants: { where: { userId: reporterId }, select: { userId: true } } } } } });
      if (!target) throw new HttpError(404, "REPORT_TARGET_NOT_FOUND", "La cible du signalement n’existe pas.");
      if (!target.conversation.participants.length) throw new HttpError(403, "ACCESS_DENIED", "Vous devez participer à cette conversation pour signaler le message.");
      targetMessageId = target.id;
      break;
    }
  }
  const report = await prisma.report.create({
    data: {
      reporterId,
      targetType: payload.targetType as ReportTargetType,
      targetUserId,
      targetServiceId,
      targetReviewId,
      targetMessageId,
      reason: payload.reason,
      description: payload.description ?? null,
    },
    select: { id: true, targetType: true, reason: true, status: true, createdAt: true },
  });
  response.status(201).json({ data: report });
};

const listReports: RequestHandler = async (request, response) => {
  const parsed = reportListSchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Le filtre de signalement est invalide.");
  const reports = await prisma.report.findMany({
    where: parsed.data.status ? { status: parsed.data.status as ReportStatus } : {},
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
      targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      targetService: { select: { id: true, title: true, slug: true } },
      targetReview: { select: { id: true, rating: true, comment: true } },
      targetMessage: { select: { id: true, content: true, conversationId: true } },
    },
  });
  response.status(200).json({ data: reports });
};

const decideReport: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const moderator = response.locals.admin;
  if (!moderator) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous connecter pour continuer.");
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const payload = request.body as z.output<typeof reportDecisionSchema>;
  const current = await prisma.report.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) throw new HttpError(404, "REPORT_NOT_FOUND", "Le signalement n’existe pas.");
  if (current.status !== ReportStatus.PENDING && current.status !== ReportStatus.UNDER_REVIEW) {
    throw new HttpError(409, "REPORT_ALREADY_CLOSED", "Ce signalement a déjà été clôturé.");
  }
  const resolvedAt = payload.status === ReportStatus.RESOLVED || payload.status === ReportStatus.REJECTED ? new Date() : null;
  const result = await prisma.report.updateMany({
    where: { id, status: current.status },
    data: { status: payload.status as ReportStatus, moderatorId: moderator.id, moderatorNotes: payload.moderatorNotes ?? null, resolvedAt },
  });
  if (!result.count) throw new HttpError(409, "REPORT_CHANGED", "Le signalement a été modifié simultanément.");
  const report = await prisma.report.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, moderatorId: true, moderatorNotes: true, resolvedAt: true } });
  response.status(200).json({ data: report });
};

export const adminOperationsRouter = Router();
adminOperationsRouter.get("/users", requireAdmin, listUsers);
adminOperationsRouter.patch("/users/:id/status", requireSuperAdmin, validateParams(idParamsSchema), validateBody(accountStatusSchema), updateUserStatus);
adminOperationsRouter.get("/reports", requireAdmin, listReports);
adminOperationsRouter.patch("/reports/:id", requireAdmin, validateParams(idParamsSchema), validateBody(reportDecisionSchema), decideReport);

export const reportRouter = Router();
reportRouter.use(requireUserAuthentication);
reportRouter.post("/", validateBody(reportCreateSchema), createReport);