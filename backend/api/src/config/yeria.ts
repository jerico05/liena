import { YeriaApp } from "@numerum-tech/yeriasdk";
import { config } from "./env";

let app: YeriaApp | null | undefined;

export const yeriaConfig = Object.freeze({
  baseUrl: config.YERIA_BASE_URL,
  appId: config.YERIA_APP_ID,
  serviceId: config.YERIA_SERVICE_ID,
  devKeyId: config.YERIA_DEV_KEY_ID,
});

/**
 * Returns the process-wide Yeria SDK instance when the service identity is
 * configured. The private key is optional for token verification, but is
 * passed through when present for signed responses and provider calls.
 */
export function getYeriaApp(): YeriaApp | null {
  if (app !== undefined) return app;
  if (!yeriaConfig.appId || !yeriaConfig.serviceId) {
    app = null;
    return app;
  }

  app = new YeriaApp({
    appId: yeriaConfig.appId,
    baseUrl: yeriaConfig.baseUrl,
    ...(config.servicePrivateKey ? { privateKey: config.servicePrivateKey } : {}),
    ...(yeriaConfig.devKeyId ? { devKeyId: yeriaConfig.devKeyId } : {}),
  });
  return app;
}
