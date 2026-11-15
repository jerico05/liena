import * as providerService from "../providers/provider.service";

export const BROWSE_ALL_PROVIDERS_SERVICE_LABEL = "Voir les prestataires";

/** Aligné sur `categoryServicesScreen` : index 1 peut correspondre au libellé de repli. */
export async function resolveCategoryServiceSelection(
  categoryId: number,
  serviceIndex: number,
): Promise<{ service?: string } | null> {
  const services = await providerService.listDistinctServices({ categoryId });
  const displayList = services.length === 0 ? [BROWSE_ALL_PROVIDERS_SERVICE_LABEL] : services;
  const label = displayList[serviceIndex - 1];
  if (!label) return null;
  if (label === BROWSE_ALL_PROVIDERS_SERVICE_LABEL) return {};
  return { service: label };
}