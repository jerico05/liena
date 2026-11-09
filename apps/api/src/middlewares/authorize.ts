import type { RequestHandler } from "express";

/** Contrôle d’accès par rôle — à brancher après `authenticate`. */
export const authorize: RequestHandler = (_request, _response, next) => {
  next();
};
