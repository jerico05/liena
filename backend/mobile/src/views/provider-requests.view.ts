import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ICONS } from "../config/icons";
import { SCREENS } from "../config/screens";
import type { ProviderRequestItem } from "../types/catalog";

/** Liste des demandes côté prestataire — ActionListView (complément écran 7). */
export function buildProviderRequestsView(requests: ProviderRequestItem[]): BaseView {
  const view = YeriaUI.createActionListView("liena-provider-requests", "Demandes reçues").setIntro(
    "Traite les demandes qui te sont adressées",
  );

  if (requests.length === 0) {
    return view.addAction("empty", "Aucune demande", "Les nouvelles demandes s’afficheront ici.", ICONS.empty, true, {
      url: SCREENS.providerManage,
    });
  }

  for (const request of requests) {
    const gps =
      request.locationLat && request.locationLon
        ? `GPS ${request.locationLat}, ${request.locationLon}`
        : null;
    const description = [
      request.status,
      request.clientContact,
      request.zone ?? "Zone non précisée",
      gps,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 240);
    view.addAction(`request-${request.id}`, `Demande #${request.id}`, description, ICONS.requestItem, false, {
      url: SCREENS.home,
    });
  }
  return view;
}
