import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ACTION_IMAGES } from "../config/icons";

export type ServiceGridItem = {
  code: string;
  label: string;
  description?: string;
};

type ServicesGridOptions = {
  viewId: string;
  title: string;
  intro: string;
  services: ServiceGridItem[];
  emptyTargetUrl: string;
};

function slugify(label: string): string {
  return label
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Liste des services avant d’afficher les prestataires. */
export function buildServicesGridView(options: ServicesGridOptions): BaseView {
  const view = YeriaUI.createActionGridView(options.viewId, options.title)
    .setIntro(options.intro)
    .setColumns(1)
    .setSpacing(10);

  if (options.services.length === 0) {
    return view.addAction("empty", "Aucun service", "Reviens plus tard.", ACTION_IMAGES.empty, true, {
      go: options.emptyTargetUrl,
    });
  }

  for (const service of options.services) {
    const code = service.code || `service-${slugify(service.label)}`;
    view.addAction(
      code,
      service.label,
      service.description ?? "Voir les prestataires pour ce service",
      ACTION_IMAGES.browse,
      false,
    );
  }
  return view;
}