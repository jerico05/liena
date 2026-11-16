import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";

type ProviderStatus = {
  displayName: string;
  status: string;
  zone: string;
  services: string;
  categoryLabel: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente de validation",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  SUSPENDED: "Suspendu",
  ARCHIVED: "Archivé",
};

/** Statut du profil prestataire — ReaderView (complément écran 7). */
export function buildProviderStatusView(profile: ProviderStatus): BaseView {
  const statusLabel = STATUS_LABELS[profile.status] ?? profile.status;
  const pendingHint =
    profile.status === "PENDING"
      ? "\n\nL’équipe Liena examine ta candidature. La gestion des demandes clients sera disponible après approbation."
      : profile.status === "APPROVED"
        ? "\n\nTon espace prestataire est actif : ouvre « Gestion de services » depuis l’accueil."
        : "";
  return YeriaUI.createReaderView("liena-provider-status", "Mon profil")
    .setIntro(`Statut : ${statusLabel}`)
    .addParagraph(`${profile.displayName} · ${profile.categoryLabel}`)
    .addSubTitle("Zone")
    .addParagraph(profile.zone)
    .addSubTitle("Services")
    .addParagraph(`${profile.services}${pendingHint}`);
}
