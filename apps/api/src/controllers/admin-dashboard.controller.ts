import type { RequestHandler } from "express";
import { getAdminDashboard } from "../services/admin-dashboard.service";

export const getDashboard: RequestHandler = async (_request, response, next) => {
  try {
    const payload = await getAdminDashboard();
    response.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};
