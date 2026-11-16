import type { RequestHandler } from "express";
import { HttpError } from "../../middlewares/errorHandler";
import { categoryIdParamsSchema } from "./yeria.validator";

/** `cat-3` ou `3` → id métier. */
export function resolveCategoryId(segment: string): number | null {
  const fromCode = /^cat-(\d+)$/.exec(segment);
  if (fromCode) return Number(fromCode[1]);
  if (/^[1-9]\d*$/.test(segment)) return Number(segment);
  return null;
}

export function attachResolvedCategoryId(paramName: "categoryId" | "segment" = "categoryId"): RequestHandler {
  return (request, response, next) => {
    const raw = request.params[paramName];
    if (typeof raw !== "string") {
      next(new HttpError(404, "CATEGORY_NOT_FOUND", "Métier invalide."));
      return;
    }
    const categoryId = resolveCategoryId(raw);
    if (categoryId === null || !Number.isSafeInteger(categoryId)) {
      next(new HttpError(404, "CATEGORY_NOT_FOUND", "Métier invalide."));
      return;
    }
    const parsed = categoryIdParamsSchema.safeParse({ categoryId });
    if (!parsed.success) {
      next(new HttpError(404, "CATEGORY_NOT_FOUND", "Métier invalide."));
      return;
    }
    request.validatedParams = parsed.data;
    next();
  };
}