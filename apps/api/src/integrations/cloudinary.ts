import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { config } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";

export type StoredMediaRef = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
};

function assertCloudinaryConfigured() {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new HttpError(
      503,
      "CLOUDINARY_NOT_CONFIGURED",
      "Le stockage d’images n’est pas configuré (variables Cloudinary manquantes).",
    );
  }
}

function configureClient() {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadProviderPortfolioImage(
  buffer: Buffer,
  yeriaSub: string,
  index: number,
): Promise<StoredMediaRef> {
  assertCloudinaryConfigured();
  configureClient();

  const folder = `liena/providers/${yeriaSub.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  let result: UploadApiResponse;
  try {
    result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `portfolio-${Date.now()}-${index}`,
          resource_type: "image",
          overwrite: false,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(buffer);
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "connexion Cloudinary";
    throw new HttpError(
      502,
      "CLOUDINARY_UPLOAD_FAILED",
      `Envoi des photos impossible (${detail}). Vérifie ta connexion internet et réessaie.`,
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}
