import type { RequestHandler } from "express";

/** Authentification des canaux client / prestataire — à brancher sur les modules métier. */
export const authenticate: RequestHandler = (_request, _response, next) => {
  next();
};
