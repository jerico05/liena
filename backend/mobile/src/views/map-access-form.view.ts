import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { MAP_FORM_FIELDS } from "@liena/shared-schemas";

/** Étape 1 carte — partager sa position avant d’afficher les prestataires. */
export function buildMapAccessFormView(): BaseView {
  const fields = MAP_FORM_FIELDS;
  return YeriaUI.createFormView("liena-map", "Carte des prestataires")
    .setIntro("Autorise ta position pour centrer la carte et voir les prestataires autour de toi")
    .addGPSField(fields.location, "Ta position actuelle", true, true, {
      maxAccuracy: 120,
    })
    .submitButton("Voir la carte", "POST");
}