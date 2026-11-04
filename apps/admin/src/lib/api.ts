import type { ApiErrorBody } from "./types";

export const API_ROOT = `${(import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "")}/admin`;

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Nom d’utilisateur ou mot de passe incorrect.",
  RATE_LIMITED: "Trop de tentatives. Réessayez dans quelques minutes.",
  CSRF_REJECTED: "La session de sécurité a expiré. Rechargez la page.",
  AUTHENTICATION_REQUIRED: "Veuillez vous connecter pour continuer.",
  DATABASE_UNAVAILABLE: "La base de données est momentanément indisponible.",
  PROVIDER_NOT_FOUND: "Ce prestataire est introuvable.",
  PROVIDER_ALREADY_REVIEWED: "Cette demande a déjà été traitée.",
  VALIDATION_ERROR: "Les informations envoyées sont incomplètes.",
};

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export async function ensureCsrf(): Promise<string> {
  const response = await fetch(`${API_ROOT}/csrf`, { credentials: "include", cache: "no-store" });
  const body = await readBody(response);
  if (!response.ok || typeof body?.csrfToken !== "string") {
    throw new ApiError("Impossible de préparer la connexion sécurisée.", response.status);
  }
  csrfToken = body.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    csrfToken ??= await ensureCsrf();
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError("L’API d’administration est injoignable.", 0);
  }

  const body = await readBody(response);
  if (body && typeof body.csrfToken === "string") csrfToken = body.csrfToken;
  if (!response.ok) throw new ApiError(errorMessage(body, response.status), response.status);
  return body as T;
}

async function readBody(response: Response): Promise<(ApiErrorBody & { csrfToken?: string }) | null> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiErrorBody & { csrfToken?: string };
  } catch {
    return null;
  }
}

function errorMessage(body: ApiErrorBody | null, status: number): string {
  const code = body?.error?.code;
  if (code && errorMessages[code]) return errorMessages[code];
  if (body?.error?.message) return body.error.message;
  if (status === 401) return errorMessages.AUTHENTICATION_REQUIRED;
  return "Une erreur est survenue. Réessayez.";
}
