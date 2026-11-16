import { YeriaUI } from "@numerum-tech/yeriasdk";
import type { BaseView } from "@numerum-tech/yeriasdk";
import { ICONS } from "../config/icons";
import { SCREENS } from "../config/screens";

type ManageContext = {
  displayName?: string;
  status?: string;
  requestCount?: number;
};

function statusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    PENDING: "En attente de validation",
    APPROVED: "Approuvé",
    REJECTED: "Refusé",
    SUSPENDED: "Suspendu",
    ARCHIVED: "Archivé",
    AUCUN_PROFIL: "Aucun profil",
  };
  return status ? (labels[status] ?? status) : "inconnu";
}

/** Écran 7 — Gestion de services (prestataire approuvé) ou suivi de candidature. */
export function buildProviderManageView(context: ManageContext): BaseView {
  const status = context.status ?? "AUCUN_PROFIL";
  const label = statusLabel(status);
  const intro =
    context.displayName !== undefined
      ? `${context.displayName} · ${label}`
      : status === "APPROVED"
        ? "Gère ton profil et les demandes reçues"
        : "Suivi de ta candidature prestataire";

  const view = YeriaUI.createActionListView("liena-provider-manage", "Gestion de services").setIntro(intro);

  if (status === "AUCUN_PROFIL") {
    return view.addAction("apply", "Devenir prestataire", "Créer une candidature", ICONS.becomeProvider, false, {
      url: SCREENS.providerOnboarding,
    });
  }

  view.addAction("status", "Statut de candidature", label, ICONS.status, false, {
    url: SCREENS.providerStatus,
  });

  if (status === "DRAFT") {
    view
      .addAction("profile", "Compléter mon profil", "Modifier les informations du dossier", ICONS.profile, false, {
        url: SCREENS.providerOnboarding,
      })
      .addAction("submit", "Envoyer à la modération", "Soumettre le dossier pour validation", ICONS.submit, false, {
        url: SCREENS.providerSubmit,
      });
    return view;
  }

  if (status === "PENDING") {
    return view;
  }

  if (status === "REJECTED") {
    return view;
  }

  if (status === "APPROVED") {
    view
      .addAction("requests", "Demandes reçues", `${context.requestCount ?? 0} demande(s)`, ICONS.requests, false, {
        url: SCREENS.providerRequests,
      })
      .addAction("profile", "Mon profil", "Consulter les informations publiques", ICONS.profile, false, {
        url: SCREENS.providerStatus,
      });
  }

  return view;
}
