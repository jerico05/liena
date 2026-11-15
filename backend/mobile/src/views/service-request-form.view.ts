import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { SERVICE_REQUEST_FIELDS } from "@liena/shared-schemas";

export const SERVICE_REQUEST_FORM_ID = "liena-service-request";

/** Formulaire client — demande de service vers un prestataire. */
export function buildServiceRequestFormView(providerId: string, providerName: string): BaseView {
  const fields = SERVICE_REQUEST_FIELDS;
  return YeriaUI.createFormView(SERVICE_REQUEST_FORM_ID, "Demander un service")
    .setIntro(`Décris ton besoin pour ${providerName}`)
    .addHiddenField(fields.providerProfileId, "Prestataire", providerId)
    .addTextAreaField(fields.description, "Description du besoin", true, 5, 10_000)
    .addTextField(fields.zone, "Lieu d’intervention", false, 160)
    .addTextField(fields.clientContact, "Téléphone ou e-mail", true, 200)
    .addGPSField(fields.location, "Ta position actuelle", true, true, {
      maxAccuracy: 150,
    })
    .submitButton("Envoyer la demande", "POST");
}
