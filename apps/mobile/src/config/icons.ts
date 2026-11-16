/**
 * Chemins relatifs à l’URL de la vue Yeria (sans `/` initial).
 * Ex. depuis `/screens/categories` → `/screens/assets/icons/...`
 */
export const ICONS = {
  browse: "assets/icons/browse.png",
  search: "assets/icons/search.png",
  map: "assets/icons/map.png",
  provider: "assets/icons/become-provider.png",
  becomeProvider: "assets/icons/become-provider.png",
  status: "assets/icons/status.png",
  profile: "assets/icons/profile.png",
  submit: "assets/icons/submit.png",
  requests: "assets/icons/requests.png",
  empty: "assets/icons/empty.png",
  providerCard: "assets/icons/provider-card.png",
  requestItem: "assets/icons/request-item.png",
  categoryDefault: "assets/icons/categories/default.png",
} as const;

const CATEGORY_SLUG: Record<string, string> = {
  Plomberie: "plumbing",
  Électricité: "electricity",
  Nettoyage: "cleaning",
  "Réparation et entretien": "repair",
  "Travaux et rénovation": "renovation",
  "Beauté et bien-être": "beauty",
  Informatique: "it",
  "Assistance et services à domicile": "home-care",
};

/** Vignettes 256×256 pour ActionGrid (métiers / catégories). */
export function categoryGridImagePath(label: string): string {
  const slug = CATEGORY_SLUG[label];
  return slug ? `assets/images/categories/${slug}.png` : "assets/images/categories/default.png";
}

/** Vignettes 256×256 — ActionGrid uniquement (pas ActionList). */
export const ACTION_IMAGES = {
  browse: "assets/images/actions/browse.png",
  search: "assets/images/actions/search.png",
  map: "assets/images/actions/map.png",
  becomeProvider: "assets/images/actions/become-provider.png",
  empty: "assets/images/actions/empty.png",
} as const;

/** Icônes 96×96 — ActionList (métiers en liste si besoin). */
export function categoryIconPath(label: string): string {
  const slug = CATEGORY_SLUG[label];
  return slug ? `assets/icons/categories/${slug}.png` : ICONS.categoryDefault;
}
