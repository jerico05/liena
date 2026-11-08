import type { RequestHandler } from "express";
import {
  currentAdminUsername,
  issueCsrfToken,
  loginAdmin,
  logoutAdmin,
  refreshCsrfForSession,
} from "./admin-auth.service";
import type { AdminLoginInput } from "./admin-auth.validator";

export const getCsrf: RequestHandler = (_request, response) => {
  const csrfToken = issueCsrfToken(response);
  response.status(200).json({ csrfToken });
};

export const postLogin: RequestHandler = (request, response) => {
  const csrfToken = loginAdmin(request, response, request.validatedBody as AdminLoginInput);
  response.status(200).json({
    data: { username: currentAdminUsername() },
    csrfToken,
  });
};

export const getMe: RequestHandler = (request, response) => {
  const username = response.locals.admin?.username ?? currentAdminUsername();
  const csrfToken = refreshCsrfForSession(request, response);
  response.status(200).json({
    data: { username },
    ...(csrfToken ? { csrfToken } : {}),
  });
};

export const postLogout: RequestHandler = (request, response) => {
  logoutAdmin(request, response);
  response.status(204).send();
};
