/** Chemins des écrans Yeria servis par l’API (`/screens/...`). */
export const SCREENS = {
  home: "/screens/home",
  categories: "/screens/categories",
  /** Yeria résout souvent `/screens/categories/:id` (sans segment `/services`). */
  categoryServices: (categoryId: number) => `/screens/categories/${categoryId}`,
  categoryProviders: (categoryId: number) => `/screens/categories/${categoryId}/providers`,
  search: "/screens/search",
  searchServices: "/screens/search/services",
  searchResults: "/screens/search/results",
  providerDetail: (id: string) => `/screens/providers/${id}`,
  serviceRequest: (providerId: string) => `/screens/providers/${providerId}/request`,
  map: "/screens/map",
  providerOnboarding: "/screens/provider/onboarding",
  providerManage: "/screens/provider/manage",
  providerStatus: "/screens/provider/status",
  providerRequests: "/screens/provider/requests",
  providerSubmit: "/screens/provider/submit",
} as const;

export function withQuery(path: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}
