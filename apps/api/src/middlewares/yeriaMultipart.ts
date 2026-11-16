import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "./errorHandler";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 8,
    fieldSize: 512 * 1024,
  },
});

import { PROVIDER_ONBOARDING_FIELDS } from "@liena/shared-schemas";

const PORTFOLIO_FIELD = PROVIDER_ONBOARDING_FIELDS.portfolioPhotos;

function isMultipart(request: { headers: { "content-type"?: string } }) {
  const contentType = request.headers["content-type"] ?? "";
  return contentType.includes("multipart/form-data");
}

/** Parse les soumissions FormView Yeria (champs texte + fichiers photo). */
export const parseYeriaMultipart: RequestHandler = (request, response, next) => {
  if (!isMultipart(request)) return next();

  upload.any()(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          "UPLOAD_TOO_LARGE",
          error.code === "LIMIT_FILE_SIZE"
            ? "Une image dépasse la taille maximale autorisée (8 Mo)."
            : "Trop de fichiers ou type de fichier refusé.",
        ),
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

export function collectPortfolioUploads(request: {
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
}): Express.Multer.File[] {
  const { files } = request;
  if (!files) return [];
  if (Array.isArray(files)) {
    return files.filter((file) => file.fieldname === PORTFOLIO_FIELD || file.fieldname.startsWith(`${PORTFOLIO_FIELD}`));
  }
  const bucket = files[PORTFOLIO_FIELD];
  return Array.isArray(bucket) ? bucket : [];
}

export const PORTFOLIO_PHOTOS_FIELD = PORTFOLIO_FIELD;
