import type { Express } from "express";
import { uploadProviderPortfolioImage, type StoredMediaRef } from "../../integrations/cloudinary";
import { HttpError } from "../../middlewares/errorHandler";
import { collectPortfolioUploads } from "../../middlewares/yeriaMultipart";

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/jpg"]);

export function parseGpsField(value: unknown): { lat: number; lon: number; accuracy?: number } | null {
  if (value === undefined || value === null || value === "") return null;

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const lat = Number(record.lat ?? record.latitude);
  const lon = Number(record.lon ?? record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const accuracyRaw = record.accuracy ?? record.acc;
  const accuracy = accuracyRaw === undefined ? undefined : Number(accuracyRaw);
  if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) return null;

  return { lat, lon, ...(accuracy !== undefined ? { accuracy } : {}) };
}

export async function uploadPortfolioPhotos(
  yeriaSub: string,
  files: Express.Multer.File[],
): Promise<StoredMediaRef[]> {
  const uploads = files.filter((file) => ACCEPTED_MIME.has(file.mimetype));
  if (uploads.length === 0) {
    throw new HttpError(
      400,
      "PORTFOLIO_PHOTOS_REQUIRED",
      "Ajoute au moins une photo (JPEG ou PNG). Si le problème persiste, vérifie que le service est bien joint (tunnel ngrok actif).",
    );
  }

  return Promise.all(
    uploads.map((file, index) => uploadProviderPortfolioImage(file.buffer, yeriaSub, index)),
  );
}

export async function resolveOnboardingMedia(
  yeriaSub: string,
  request: { files?: Express.Multer.File[] | Record<string, Express.Multer.File[]> },
): Promise<StoredMediaRef[]> {
  return uploadPortfolioPhotos(yeriaSub, collectPortfolioUploads(request));
}
