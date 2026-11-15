import type { RequestHandler } from "express";
import * as service from "./category.service";

export const listCategories: RequestHandler = async (_request, response, next) => {
  try { response.json({ data: await service.listCategories() }); } catch (error) { next(error); }
};
