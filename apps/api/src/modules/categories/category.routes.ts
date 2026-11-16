import { Router } from "express";
import * as controller from "./category.controller";

export function createCategoryRouter() {
  const router = Router();
  router.get("/categories", controller.listCategories);
  return router;
}

export const categoryRouter = createCategoryRouter();
