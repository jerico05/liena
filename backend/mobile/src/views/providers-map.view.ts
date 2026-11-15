import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { SCREENS } from "../config/screens";

export type MapProviderMarker = {
  id: string;
  displayName: string;
  categoryLabel: string;
  zone: string;
  lat: number;
  lon: number;
};

type ProvidersMapOptions = {
  clientLocation: { lat: number; lon: number };
  providers: MapProviderMarker[];
};

/** Écran carte — MapView centrée sur le client, marqueurs GPS réels. */
export function buildProvidersMapView(options: ProvidersMapOptions): BaseView {
  const { clientLocation, providers } = options;
  const map = YeriaUI.createMapView("liena-providers-map", "Autour de vous")
    .setIntro(
      providers.length === 0
        ? "Aucun prestataire avec position GPS pour le moment"
        : `${providers.length} prestataire(s) sur la carte`,
    )
    .setViewport({ center: clientLocation, zoom: 13 })
    .setControls({ zoom: true, compass: true });

  map.addMarker({
    id: "client-position",
    location: clientLocation,
    title: "Votre position",
    description: "Point de départ",
  });

  if (providers.length === 0) {
    map.setEmptyMessage(
      "Aucun prestataire avec coordonnées GPS publiées pour le moment. Reviens plus tard ou utilise Parcourir / Rechercher.",
    );
    return map;
  }

  for (const provider of providers) {
    map.addMarker({
      id: provider.id,
      location: { lat: provider.lat, lon: provider.lon },
      title: provider.displayName,
      description: `${provider.categoryLabel} · ${provider.zone}`,
      action: { url: SCREENS.providerDetail(provider.id) },
    });
  }
  return map;
}