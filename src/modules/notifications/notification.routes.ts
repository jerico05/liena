import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication } from "../shared/request-user";

const notificationIdSchema = z.object({ id: z.string().uuid() }).strict();

const listNotifications: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  response.status(200).json({ data: notifications });
};

const markNotificationRead: RequestHandler<z.output<typeof notificationIdSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof notificationIdSchema>;

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true, readAt: true },
  });

  if (!notification) {
    throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "La notification n’existe pas.");
  }

  if (notification.userId !== userId) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas modifier cette notification.");
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  response.status(200).json({ data: updated });
};

const markAllNotificationsRead: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);

  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  response.status(200).json({ data: { updated: result.count } });
};

export const notificationRouter = Router();
notificationRouter.use(requireUserAuthentication);
notificationRouter.get("/", listNotifications);
notificationRouter.patch("/:id/read", validateParams(notificationIdSchema), markNotificationRead);
notificationRouter.patch("/read-all", markAllNotificationsRead);
