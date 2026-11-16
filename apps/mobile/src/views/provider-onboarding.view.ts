import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { PROVIDER_ONBOARDING_FIELDS } from "@liena/shared-schemas";
import type { SelectOption } from "../types/catalog";

/** Écran 6 — Candidature prestataire — FormView (POST sur `/screens/provider/onboarding`). */
export function buildProviderOnboardingView(categoryOptions: SelectOption[]): BaseView {
  const fields = PROVIDER_ONBOARDING_FIELDS;
  const form = YeriaUI.createFormView("liena-provider-onboarding", "Devenir prestataire")
    .setIntro("Complète ce formulaire pour créer ton profil professionnel")
    .addTextField(fields.displayName, "Nom affiché", true, 160)
    .addSelectField(
      fields.categoryId,
      "Catégorie",
      true,
      categoryOptions.map((option) => ({ value: option.value, label: option.label })),
    )
    .addTextAreaField(fields.services, "Services proposés", true, 3, 2_000)
    .addTextField(fields.zone, "Ville ou zone d’intervention", true, 160)
    .addTextAreaField(fields.description, "Description", true, 10, 10_000)
    .addTextField(fields.contact, "Contact (téléphone ou e-mail)", true, 200)
    .addTextField(fields.indicativePrice, "Tarif indicatif (optionnel)", false, 20)
    .addPhotoField(fields.portfolioPhotos, "Photos de ton activité", true, ["jpeg", "png"], false, {
      multiple: true,
      maxCount: 6,
      source: "both",
    })
    .addGPSField(fields.location, "Ta position actuelle", true, true, {
      maxAccuracy: 100,
    })
    .submitButton("Envoyer ma candidature", "POST");

  return form;
}
