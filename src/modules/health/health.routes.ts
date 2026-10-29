import { Router } from "express";
import { HttpError } from "../../http/errors";
import { prisma } from "../../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: "ok" });
  } catch (error) {
    next(
      new HttpError(503, "DATABASE_UNAVAILABLE", "The database is temporarily unavailable.", {
        cause: error,
      }),
    );
  }
});
