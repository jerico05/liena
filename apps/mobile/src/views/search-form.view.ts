import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { SEARCH_FORM_FIELDS } from "@liena/shared-schemas";
import type { SelectOption } from "../types/catalog";

/** Recherche : ville/quartier, métier, GPS client. */
export function buildSearchFormView(categoryOptions: SelectOption[]): BaseView {
  const fields = SEARCH_FORM_FIELDS;
  return YeriaUI.createFormView("liena-search", "Rechercher")
    .setIntro("Indique où tu es, choisis un métier et partage ta position pour les prestataires les plus proches")
    .addTextField(fields.zone, "Ville ou quartier", false, 160)
    .addSelectField(
      fields.categoryId,
      "Métier",
      true,
      categoryOptions.map((option) => ({ value: option.value, label: option.label })),
    )
    .addGPSField(fields.location, "Ta position actuelle", true, true, {
      maxAccuracy: 120,
    })
    .submitButton("Voir les prestataires", "POST");
}