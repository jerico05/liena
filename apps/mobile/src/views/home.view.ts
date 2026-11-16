import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ICONS } from "../config/icons";
import { SCREENS } from "../config/screens";

/** Écran 1 — Accueil (ActionListView). */
export function buildHomeView(): BaseView {
  return YeriaUI.createActionListView("liena-home", "Liena")
    .setIntro("Prestataires de confiance, près de chez vous")
    .addAction("browse", "Parcourir", "Parcourir les métiers, services et prestataires", ICONS.browse, false, {
      url: SCREENS.categories,
    })
    .addAction("search", "Rechercher", "Retrouver un service en fonction de ta situation", ICONS.search, false, {
      url: SCREENS.search,
    })
    .addAction(
      "become-provider",
      "Devenir prestataire",
      "Faire une demande pour devenir prestataire",
      ICONS.becomeProvider,
      false,
      { url: SCREENS.providerOnboarding },
    )
    .addAction("map", "Carte", "Voir les prestataires sur la carte", ICONS.map, false, {
      url: SCREENS.map,
    });
}
