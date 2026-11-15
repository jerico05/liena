import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ACTION_IMAGES, categoryGridImagePath } from "../config/icons";
import { SCREENS } from "../config/screens";
import type { PublicProviderCard } from "../types/catalog";

function priceLabel(price: string | null): string {
  if (!price) return "Sur devis";
  return `${price} XOF`;
}

/** Écran 3 — Résultats de recherche — ActionGridView. */
export function buildProviderResultsView(
  providers: PublicProviderCard[],
  options: { title?: string; intro?: string; emptyMessage?: string; emptyBackUrl?: string } = {},
): BaseView {
  const view = YeriaUI.createActionGridView("liena-provider-results", options.title ?? "Résultats")
    .setIntro(options.intro ?? "Prestataires correspondant à ta recherche")
    .setColumns(1)
    .setSpacing(10);

  if (providers.length === 0) {
    const emptyIntro =
      options.emptyMessage ??
      "Aucun prestataire pour ce service pour l’instant. Essaie un autre service ou reviens plus tard.";
    return view.addAction("empty", "Aucun prestataire", emptyIntro, ACTION_IMAGES.search, false, {
      url: options.emptyBackUrl ?? SCREENS.search,
    });
  }

  for (const provider of providers) {
    const description = [
      provider.distanceLabel,
      provider.categoryLabel,
      provider.zone,
      priceLabel(provider.indicativePrice),
      provider.services,
    ]
      .filter(Boolean)
      .join(" · ");
    view.addAction(
      `provider-${provider.id}`,
      provider.displayName,
      description.slice(0, 240),
      categoryGridImagePath(provider.categoryLabel),
      false,
    );
  }
  return view;
}
