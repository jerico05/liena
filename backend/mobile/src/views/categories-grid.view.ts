import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ACTION_IMAGES, categoryGridImagePath } from "../config/icons";
import { SCREENS } from "../config/screens";
import type { CategoryItem } from "../types/catalog";

/** Écran 2 — Liste des métiers — ActionGridView. */
export function buildCategoriesGridView(categories: CategoryItem[]): BaseView {
  const view = YeriaUI.createActionGridView("liena-categories", "Métiers")
    .setIntro("Choisis un métier pour voir les services proposés")
    .setColumns(2)
    .setSpacing(12);

  if (categories.length === 0) {
    return view.addAction("empty", "Aucune catégorie", "Revenez plus tard.", ACTION_IMAGES.empty, true, {
      url: SCREENS.home,
    });
  }

  for (const category of categories) {
    view.addAction(
      `cat-${category.id}`,
      category.label,
      "Découvre les services de ce métier",
      categoryGridImagePath(category.label),
      false,
    );
  }
  return view;
}
