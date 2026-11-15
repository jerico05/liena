import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { SCREENS } from "../config/screens";
import type { PublicProviderDetail } from "../types/catalog";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80";

function heroFromMedia(mediaRefs: unknown): string | undefined {
  if (!mediaRefs || typeof mediaRefs !== "object") return undefined;
  const record = mediaRefs as Record<string, unknown>;
  const hero = record.hero ?? record.image ?? record.cover;
  return typeof hero === "string" && hero.startsWith("http") ? hero : undefined;
}

/** Écran 4 — Fiche prestataire — ReaderView. */
export function buildProviderDetailView(provider: PublicProviderDetail): BaseView {
  const reader = YeriaUI.createReaderView(`liena-provider-${provider.id}`, provider.displayName).setIntro(
    `${provider.categoryLabel} · ${provider.zone}`,
  );

  reader.addImage(heroFromMedia(provider.mediaRefs) ?? PLACEHOLDER_IMAGE, provider.displayName);
  reader.addParagraph(provider.description);
  reader.addSubTitle("Prestations");
  reader.addParagraph(provider.services);
  reader.addSubTitle("Contact");
  reader.addParagraph(provider.contact);
  if (provider.indicativePrice) {
    reader.addSubTitle("Tarif indicatif");
    reader.addParagraph(`${provider.indicativePrice} XOF`);
  }
  reader.addLink("Envoyer une demande", SCREENS.serviceRequest(provider.id));
  return reader;
}
