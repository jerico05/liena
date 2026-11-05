import { useEffect, useState } from "react";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import {
  formatDate,
  formatLocation,
  formatMoney,
  formatPerson,
  initials,
  mapUrl,
} from "../lib/format";
import type { ProviderDetail as ProviderDetailData, ProviderDetailResponse } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconPin } from "./Icons";
import { AccountBadge, ServiceBadge, StatusBadge } from "./StatusBadge";

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
        setError(caught instanceof ApiError ? caught.message : "Impossible d’ouvrir cette fiche.");
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
          ? "Le prestataire est vérifié. Il peut apparaître dans la recherche de sa zone."
          : "La demande a été refusée.",
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
  const locationLabel = formatLocation(provider.city, provider.neighborhood, provider.countryCode);

  return (
    <>
      <button type="button" className="back-link detail-back" onClick={onBack}>← Retour</button>
      {error && <p className="form-message form-error notice" role="alert">{error}</p>}

      <section className="provider-hero panel">
        <div className="provider-hero-main">
          {provider.contact.avatarUrl ? (
            <img className="provider-hero-avatar" src={provider.contact.avatarUrl} alt="" />
          ) : (
            <span className="provider-hero-avatar provider-hero-initials">
              {initials(provider.contact.firstName, provider.contact.lastName)}
            </span>
          )}
          <div className="provider-hero-copy">
            <p className="provider-hero-eyebrow">Fiche prestataire</p>
            <h1>{provider.businessName}</h1>
            <p className="provider-hero-subtitle">
              {formatPerson(provider.contact.firstName, provider.contact.lastName)}
              <span aria-hidden="true"> · </span>
              <span className="provider-slug">{provider.slug}</span>
            </p>
            <div className="provider-hero-badges">
              <StatusBadge status={provider.status} />
              <AccountBadge status={provider.contact.accountStatus} />
            </div>
          </div>
        </div>
        <ul className="provider-stats" aria-label="Indicateurs">
          <li>
            <span>Prestations</span>
            <strong>{provider.serviceCount}</strong>
          </li>
          <li>
            <span>Avis</span>
            <strong>{provider.reviewCount}</strong>
          </li>
          <li>
            <span>Inscription</span>
            <strong>{formatDate(provider.createdAt)}</strong>
          </li>
        </ul>
      </section>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          <section className="panel provider-section">
            <header className="provider-section-head">
              <h2>Coordonnées</h2>
            </header>
            <div className="info-grid">
              <InfoItem label="E-mail" value={provider.contact.email} href={`mailto:${provider.contact.email}`} />
              <InfoItem
                label="Téléphone"
                value={provider.contact.phone ?? "Non renseigné"}
                href={provider.contact.phone ? `tel:${provider.contact.phone}` : undefined}
              />
              <InfoItem
                label="E-mail vérifié"
                value={provider.contact.emailVerifiedAt ? formatDate(provider.contact.emailVerifiedAt) : "Non vérifié"}
              />
              <InfoItem
                label="Téléphone vérifié"
                value={provider.contact.phoneVerifiedAt ? formatDate(provider.contact.phoneVerifiedAt) : "Non vérifié"}
              />
            </div>
            {provider.contact.accountStatus !== "ACTIVE" && (
              <p className="form-message form-warning provider-inline-note">
                Compte inactif : le profil ne sera pas visible tant que le compte n’est pas réactivé.
              </p>
            )}
          </section>

          <section className="panel provider-section">
            <header className="provider-section-head">
              <h2>Zone & présentation</h2>
            </header>
            <div className="location-highlight">
              <IconPin className="location-highlight-icon" />
              <div>
                <strong>{locationLabel}</strong>
                <span>Fuseau horaire {provider.timeZone}</span>
              </div>
            </div>
            <p className="provider-description">
              {provider.description?.trim() || "Aucune présentation renseignée pour ce profil."}
            </p>
            {provider.addresses.length > 0 && (
              <ul className="address-cards">
                {provider.addresses.map((address) => (
                  <li key={address.id} className="address-card">
                    <strong>{address.label || (address.isDefault ? "Adresse principale" : "Adresse")}</strong>
                    <span>{[address.street, address.neighborhood, address.city].filter(Boolean).join(", ")}</span>
                    {address.latitude !== null && address.longitude !== null && (
                      <a className="quiet-link" href={mapUrl(address.latitude, address.longitude)} target="_blank" rel="noreferrer">
                        Ouvrir sur la carte
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel provider-section">
            <header className="provider-section-head">
              <h2>Prestations</h2>
              <span className="count-badge">{provider.serviceCount}</span>
            </header>
            {provider.services.length === 0 && (
              <p className="empty-state panel-empty">Aucune prestation enregistrée.</p>
            )}
            {provider.services.length > 0 && (
              <div className="table-scroll">
                <table className="table-console">
                  <thead>
                    <tr>
                      <th scope="col">Prestation</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Tarif</th>
                      <th scope="col" className="hide-sm">Lieu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.services.map((service) => (
                      <tr key={service.id}>
                        <td>
                          <strong>{service.title}</strong>
                          <span className="table-subtext">{service.categoryName}</span>
                        </td>
                        <td><ServiceBadge status={service.status} /></td>
                        <td>{formatMoney(service.price, service.currency, service.pricingType)}</td>
                        <td className="hide-sm">{service.city ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="panel provider-decision">
          <header className="provider-section-head">
            <h2>Décision</h2>
          </header>
          {canReview && (
            <>
              <p className="provider-decision-text">
                Cette demande est en attente. Une validation rend le prestataire visible dans sa zone.
              </p>
              <div className="provider-decision-actions">
                <button type="button" className="success-button success-button-block" onClick={() => openDecision("VERIFY")}>
                  Valider le dossier
                </button>
                <button type="button" className="ghost-danger-button ghost-danger-button-block" onClick={() => openDecision("REJECT")}>
                  Refuser la demande
                </button>
              </div>
            </>
          )}
          {!canReview && (
            <p className="provider-decision-text">
              {provider.status === "VERIFIED" && `Profil validé le ${formatDate(provider.verifiedAt)}.`}
              {provider.status === "REJECTED" && "Cette demande a été refusée."}
              {provider.status === "SUSPENDED" && "Profil suspendu : la validation ne s’applique pas ici."}
            </p>
          )}
          {provider.verificationNotes && (
            <blockquote className="note-box">{provider.verificationNotes}</blockquote>
          )}
          <dl className="provider-timeline">
            <div>
              <dt>Demande reçue</dt>
              <dd>{formatDate(provider.createdAt)}</dd>
            </div>
            <div>
              <dt>Dernière mise à jour</dt>
              <dd>{formatDate(provider.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <ConfirmDialog
        open={decision !== null}
        title={decision === "REJECT" ? "Refuser la demande" : "Valider le prestataire"}
        description={
          decision === "REJECT"
            ? "Le profil reste enregistré, mais il ne sera pas proposé aux clients."
            : `${provider.businessName} pourra être trouvé par les clients de ${provider.city}.`
        }
        confirmLabel={decision === "REJECT" ? "Refuser la demande" : "Valider le prestataire"}
        tone={decision === "REJECT" ? "danger" : "primary"}
        isSubmitting={isSubmitting}
        confirmDisabled={decision === "REJECT" && notes.trim().length < 3}
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

function InfoItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="info-item">
      <span className="info-item-label">{label}</span>
      {href ? (
        <a className="info-item-value quiet-link" href={href}>{value}</a>
      ) : (
        <span className="info-item-value">{value}</span>
      )}
    </div>
  );
}
