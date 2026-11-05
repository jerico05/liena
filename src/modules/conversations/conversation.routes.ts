import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication } from "../shared/request-user";

const conversationIdSchema = z.object({ id: z.string().uuid() }).strict();

const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(2000),
  })
  .strict();
const markReadSchema = z.object({ id: z.string().uuid() }).strict();

const listConversations: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
      providerProfile: { select: { id: true, businessName: true, slug: true } },
      _count: { select: { messages: true } },
    },
  });

  response.status(200).json({ data: conversations });
};

const getConversationMessages: RequestHandler<z.output<typeof conversationIdSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof conversationIdSchema>;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      participants: { select: { userId: true } },
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          senderId: true,
          content: true,
          type: true,
          createdAt: true,
          attachments: { select: { id: true, fileUrl: true, mimeType: true, byteSize: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new HttpError(404, "CONVERSATION_NOT_FOUND", "La conversation n’existe pas.");
  }

  if (!conversation.participants.some((participant) => participant.userId === userId)) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas membre de cette conversation.");
  }

  response.status(200).json({ data: conversation.messages });
};

const sendConversationMessage: RequestHandler<z.output<typeof conversationIdSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof conversationIdSchema>;
  const payload = request.body as z.output<typeof sendMessageSchema>;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, participants: { select: { userId: true } } },
  });

  if (!conversation) {
    throw new HttpError(404, "CONVERSATION_NOT_FOUND", "La conversation n’existe pas.");
  }

  if (!conversation.participants.some((participant) => participant.userId === userId)) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas autorisé à écrire dans cette conversation.");
  }

  const message = await prisma.$transaction(async (transaction) => {
    const created = await transaction.message.create({
      data: { conversationId: conversation.id, senderId: userId, type: "TEXT", content: payload.content },
      select: { id: true, conversationId: true, senderId: true, type: true, content: true, createdAt: true },
    });
    await transaction.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return created;
  });

  response.status(201).json({ data: message });
};

const markConversationRead: RequestHandler<z.output<typeof conversationIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof conversationIdSchema>;
  const participant = await prisma.conversationParticipant.updateMany({
    where: { conversationId: id, userId },
    data: { lastReadAt: new Date() },
  });
  if (!participant.count) {
    const exists = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "CONVERSATION_NOT_FOUND", "La conversation n’existe pas.");
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas membre de cette conversation.");
  }
  response.status(200).json({ data: { conversationId: id, readAt: new Date().toISOString() } });
};

export const conversationRouter = Router();
conversationRouter.use(requireUserAuthentication);
conversationRouter.get("/", listConversations);
conversationRouter.patch("/:id/read", validateParams(conversationIdSchema), markConversationRead);
conversationRouter.get("/:id/messages", validateParams(conversationIdSchema), getConversationMessages);
conversationRouter.post(
  "/:id/messages",
  validateParams(conversationIdSchema),
  validateBody(sendMessageSchema),
  sendConversationMessage,
);
