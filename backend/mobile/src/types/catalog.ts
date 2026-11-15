export type CategoryItem = {
  id: number;
  label: string;
};

export type PublicProviderCard = {
  id: string;
  displayName: string;
  categoryLabel: string;
  services: string;
  zone: string;
  description: string;
  indicativePrice: string | null;
  contact: string;
  /** Renseigné quand la recherche inclut la position client. */
  distanceKm?: number | null;
  distanceLabel?: string | null;
};

export type PublicProviderDetail = PublicProviderCard & {
  categoryId: number;
  createdAt: string;
  approvedAt: string | null;
  mediaRefs?: unknown;
};

export type ProviderRequestItem = {
  id: number;
  description: string;
  zone: string | null;
  clientContact: string | null;
  locationLat: string | null;
  locationLon: string | null;
  locationAccuracy: string | null;
  status: string;
};

export type SelectOption = { value: string; label: string };
