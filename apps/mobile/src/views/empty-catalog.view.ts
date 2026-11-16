import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";

type EmptyCatalogOptions = {
  viewId: string;
  title: string;
  body: string;
  backLabel: string;
  backUrl: string;
};

/** Aucun service / prestataire disponible pour le moment. */
export function buildEmptyCatalogView(options: EmptyCatalogOptions): BaseView {
  return YeriaUI.createMessageView(options.viewId, options.title)
    .setIntro(options.title)
    .setBody(options.body)
    .setSeverity("info")
    .addAction(options.backLabel, { go: options.backUrl });
}

/** Écran unique lorsqu’aucun prestataire n’existe pour un métier (parcours Parcourir). */
export function buildNoProvidersForTradeView(tradeLabel: string, backUrl: string): BaseView {
  return buildEmptyCatalogView({
    viewId: "liena-no-providers",
    title: "Pas de prestataires disponibles",
    body: `Aucun prestataire n’est disponible pour le métier « ${tradeLabel} » pour le moment. Tu peux essayer un autre métier ou revenir plus tard.`,
    backLabel: "Autres métiers",
    backUrl,
  });
}