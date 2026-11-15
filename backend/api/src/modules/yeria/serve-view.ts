import type { BaseView } from "@numerum-tech/yeriasdk";
import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { Request, Response } from "express";
import { getYeriaApp } from "../../config/yeria";

/** Réponses d’échec lisibles dans l’app Yeria (évite `connection_error` côté client). */
export function respondYeriaClientError(response: Response, message: string, code = "REQUEST_FAILED"): void {
  const view = YeriaUI.createMessageView(`liena-error-${code}`, "Erreur")
    .setIntro("Envoi impossible")
    .setBody(message)
    .setSeverity("error");
  respondWithYeriaView(response, view);
}

export function isYeriaClientPost(request: Pick<Request, "method" | "path" | "params">): boolean {
  if (request.method !== "POST") return false;
  if (request.path === "/become-provider" || request.path === "/map" || request.path === "/search") return true;
  if (request.path.startsWith("/screens/")) return true;
  const viewId = request.params.viewId;
  return typeof viewId === "string" && viewId.startsWith("liena-");
}

export function respondWithYeriaView(response: Response, view: BaseView): void {
  const app = getYeriaApp();
  if (!app) {
    response.status(503).json(
      YeriaUI.error({
        code: "YERIA_NOT_CONFIGURED",
        message: "Configure YERIA_APP_ID, YERIA_SERVICE_ID et service_private.pem (voir docs/api/yeria-config.md).",
      }),
    );
    return;
  }
  response.json(app.serve(view));
}
