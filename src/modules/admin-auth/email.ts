import { Resend } from "resend";
import { config } from "../../config/env";

type AdminEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendAdminEmail(email: AdminEmail): Promise<void> {
  if (!config.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(config.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: config.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`);
  }
}

export function adminLink(path: string, token: string): string {
  const url = new URL(path, config.APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
