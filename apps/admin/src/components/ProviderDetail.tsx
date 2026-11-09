import { useEffect, useState } from "react";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import { formatDate, initials } from "../lib/format";
import type { ProviderDetail as ProviderDetailData, ProviderDetailResponse } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { StatusBadge } from "./StatusBadge";

type ProviderDetailProps = {
  providerId: string;
  onBack: () => void;
  onReviewed: (message: string) => void;
  onUnauthorized: () => void;
};

type Decision = "VERIFY" | "REJECT";

export function ProviderDetail({ providerId, onBack, onReviewed, onUnauthorized }: ProviderDetailProps) {
  const [provider, setProvider] = useState<ProviderDetailData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    apiRequest<ProviderDetailResponse>(`/providers/${providerId}`, { signal: controller.signal })
      .then((body) => {
        setProvider(body.data);
        setError("");
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Impossible d’ouvrir la fiche.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [providerId, reloadKey, onUnauthorized]);

  async function submitDecision() {
    if (!decision) return;
    setDialogError("");
    setIsSubmitting(true);
    try {
      await apiRequest(`/providers/${providerId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      onReviewed(
        decision === "VERIFY"
          ? "Le profil est approuvé et peut être visible par les clients."
          : "La candidature a été refusée.",
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      if (caught instanceof ApiError && caught.status === 409) {
        setDecision(null);
        setError(caught.message);
        setReloadKey((current) => current + 1);
        return;
      }
      setDialogError(caught instanceof ApiError ? caught.message : "La décision n’a pas pu être enregistrée.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !provider) return <p className="empty-state panel-empty">Chargement de la fiche…</p>;
  if (!provider) {
    return (
      <section className="panel">
        <p className="form-message form-error panel-empty" role="alert">{error || "Cette fiche est introuvable."}</p>
        <button type="button" className="back-link detail-back" onClick={onBack}>Retour</button>
      </section>
    );
  }

  const canReview = provider.status === "PENDING";
  const rejectNeedsNote = notes.trim().length < 3;
  const mediaRefs = getMediaReferences(provider.mediaRefs);

  return (
    <>
      <button type="button" className="back-link detail-back" onClick={onBack}>← Retour</button>
      {error && <p className="form-message form-error notice" role="alert">{error}</p>}

      <section className="provider-hero panel">
        <div className="provider-hero-main">
          <span className="provider-hero-avatar provider-hero-initials">
            {initials(provider.displayName)}
          </span>
          <div className="provider-hero-copy">
            <p className="provider-hero-eyebrow">Profil professionnel</p>
            <h1>{provider.displayName}</h1>
            <p className="provider-hero-subtitle">{provider.categoryLabel} · {provider.zone}</p>
            <div className="provider-hero-badges">
              <StatusBadge status={provider.status} />
              {!provider.isActive && <span className="badge badge-suspended">Inactif</span>}
            </div>
          </div>
        </div>
        <ul className="provider-stats" aria-label="Informations du profil">
          <li>
            <span>Créé le</span>
            <strong>{formatDate(provider.createdAt)}</strong>
          </li>
          <li>
            <span>Approuvé le</span>
            <strong>{formatDate(provider.approvedAt)}</strong>
          </li>
          <li>
            <span>Tarif indicatif</span>
            <strong>{provider.indicativePrice ?? "—"}</strong>
          </li>
        </ul>
      </section>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          <section className="panel provider-section">
            <header className="provider-section-head"><h2>Profil</h2></header>
            <div className="info-grid">
              <InfoItem label="Catégorie" value={provider.categoryLabel} />
              <InfoItem label="Zone d’intervention" value={provider.zone} />
              <InfoItem label="Contact" value={provider.contact} />
              <InfoItem label="Identifiant Yeria" value={provider.yeriaSub} />
            </div>
            <p className="provider-description">
              {provider.description.trim() || "Aucune présentation renseignée."}
            </p>
          </section>

          <section className="panel provider-section">
            <header className="provider-section-head"><h2>Services proposés</h2></header>
            <p className="provider-description">{provider.services}</p>
          </section>

          <section className="panel provider-section">
            <header className="provider-section-head"><h2>Références médias</h2></header>
            {mediaRefs.length === 0 ? (
              <p className="empty-state">Aucun média référencé.</p>
            ) : (
              <ul className="address-cards">
                {mediaRefs.map((reference, index) => (
                  <li key={`${reference}-${index}`} className="address-card">{reference}</li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="panel provider-decision">
          <header className="provider-section-head"><h2>Décision</h2></header>
          {canReview ? (
            <>
              <p className="provider-decision-text">
                Cette candidature est en attente de modération.
              </p>
              <div className="provider-decision-actions">
                <button type="button" className="success-button success-button-block" onClick={() => openDecision("VERIFY")}>
                  Approuver le profil
                </button>
                <button type="button" className="ghost-danger-button ghost-danger-button-block" onClick={() => openDecision("REJECT")}>
                  Refuser la candidature
                </button>
              </div>
            </>
          ) : (
            <p className="provider-decision-text">
              {provider.status === "APPROVED" && "Ce profil est approuvé."}
              {provider.status === "REJECTED" && "Cette candidature a été refusée."}
              {provider.status === "SUSPENDED" && "Ce profil est suspendu."}
              {provider.status === "DRAFT" && "Ce profil est encore un brouillon."}
              {provider.status === "ARCHIVED" && "Ce profil est archivé."}
            </p>
          )}
          <dl className="provider-timeline">
            <div><dt>Créé le</dt><dd>{formatDate(provider.createdAt)}</dd></div>
            <div><dt>Mis à jour le</dt><dd>{formatDate(provider.updatedAt)}</dd></div>
          </dl>
        </aside>
      </div>

      <section className="panel provider-section">
        <header className="provider-section-head"><h2>Historique de modération</h2></header>
        {provider.moderationDecisions.length === 0 ? (
          <p className="empty-state">Aucune décision enregistrée.</p>
        ) : (
          <ul className="address-cards">
            {provider.moderationDecisions.map((item) => (
              <li key={item.id} className="address-card">
                <strong>{decisionLabel(item.decision)}</strong>
                <span>{formatDate(item.createdAt)} · {item.adminUsername}</span>
                {item.reason && <span>{item.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={decision !== null}
        title={decision === "REJECT" ? "Refuser la candidature" : "Approuver le profil"}
        description={
          decision === "REJECT"
            ? "Le profil restera enregistré, mais ne sera pas visible publiquement."
            : `${provider.displayName} pourra être visible dans la recherche publique.`
        }
        confirmLabel={decision === "REJECT" ? "Refuser" : "Approuver"}
        tone={decision === "REJECT" ? "danger" : "primary"}
        isSubmitting={isSubmitting}
        confirmDisabled={decision === "REJECT" && rejectNeedsNote}
        error={dialogError}
        onCancel={() => setDecision(null)}
        onConfirm={submitDecision}
      >
        <div className="field dialog-field">
          <label htmlFor="review-notes">{decision === "REJECT" ? "Motif du refus" : "Note interne"}</label>
          <textarea
            id="review-notes"
            value={notes}
            maxLength={2000}
            required={decision === "REJECT"}
            placeholder={decision === "REJECT" ? "Expliquez brièvement le refus" : "Optionnel"}
            onChange={(event) => setNotes(event.target.value)}
          />
          {decision === "REJECT" && rejectNeedsNote && <span className="hint">Trois caractères minimum.</span>}
        </div>
      </ConfirmDialog>
    </>
  );

  function openDecision(next: Decision) {
    setNotes("");
    setDialogError("");
    setDecision(next);
  }
}

function getMediaReferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function decisionLabel(decision: string): string {
  const labels: Record<string, string> = {
    APPROVE: "Profil approuvé",
    REJECT: "Candidature refusée",
    SUSPEND: "Profil suspendu",
    REACTIVATE: "Profil réactivé",
  };
  return labels[decision] ?? decision;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <span className="info-item-label">{label}</span>
      <span className="info-item-value">{value || "—"}</span>
    </div>
  );
}
