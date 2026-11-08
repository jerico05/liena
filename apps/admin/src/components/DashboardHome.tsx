import { useEffect, useState } from "react";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import { formatDate, formatLocation, formatPerson, initials } from "../lib/format";
import type { DashboardResponse, ProviderSummary, StatusFilter } from "../lib/types";
import { IconClipboard, IconEye, IconPin, IconUsers } from "./Icons";
import { KpiGrid } from "./KpiGrid";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";

const emptySummary: ProviderSummary = { pending: 0, verified: 0, rejected: 0, suspended: 0 };

type DashboardHomeProps = {
  notice?: string;
  onOpenValidations: () => void;
  onOpenStatus: (status: StatusFilter) => void;
  onOpenProvider: (providerId: string) => void;
  onUnauthorized: () => void;
};

export function DashboardHome({
  notice,
  onOpenValidations,
  onOpenStatus,
  onOpenProvider,
  onUnauthorized,
}: DashboardHomeProps) {
  const [data, setData] = useState<DashboardResponse["data"] | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<DashboardResponse>("/dashboard", { signal: controller.signal })
      .then((body) => {
        setData(body.data);
        setError("");
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Impossible de charger le tableau de bord.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [onUnauthorized]);

  const summary = data?.summary ?? emptySummary;
  const total = summary.pending + summary.verified + summary.rejected + summary.suspended;

  return (
    <>
      <PageHeader
        title="Supervision & vetting"
        description="Suivez les inscriptions prestataires et traitez les dossiers en attente."
        actions={
          summary.pending > 0 ? (
            <button type="button" className="primary-button" onClick={onOpenValidations}>
              Dossiers à valider ({summary.pending})
            </button>
          ) : undefined
        }
      />

      {notice && <p className="form-message form-success notice" role="status">{notice}</p>}
      {error && <p className="form-message form-error notice" role="alert">{error}</p>}

      <KpiGrid
        items={[
          {
            id: "registered",
            label: "Prestataires enregistrés",
            value: total,
            icon: <IconUsers />,
            onClick: () => onOpenStatus("ALL"),
          },
          {
            id: "verified",
            label: "Profils vérifiés",
            value: summary.verified,
            icon: <IconUsers />,
            onClick: () => onOpenStatus("APPROVED"),
          },
          {
            id: "pending",
            label: "Dossiers à valider",
            value: summary.pending,
            hint: summary.pending > 0 ? "À traiter" : undefined,
            icon: <IconClipboard />,
            onClick: onOpenValidations,
          },
          {
            id: "incoming",
            label: "Nouveaux (7 jours)",
            value: data?.incomingThisWeek ?? 0,
            icon: <IconClipboard />,
          },
        ]}
      />

      <section className="panel" aria-busy={isLoading}>
        <div className="panel-head">
          <h2>Dossiers prestataires à valider en priorité</h2>
        </div>

        {isLoading && !data && <p className="empty-state panel-empty">Chargement…</p>}
        {data && data.queue.length === 0 && (
          <p className="empty-state panel-empty">Aucune demande en attente pour le moment.</p>
        )}
        {data && data.queue.length > 0 && (
          <div className="table-scroll">
            <table className="table-console">
              <caption className="sr-only">File de validation</caption>
              <thead>
                <tr>
                  <th scope="col">Professionnel</th>
                  <th scope="col">Zone d’intervention</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map((provider) => (
                  <tr key={provider.id}>
                    <td>
                      <div className="identity">
                        <span className="avatar">{initials(provider.contact.firstName, provider.contact.lastName)}</span>
                        <span>
                          <strong>{formatPerson(provider.contact.firstName, provider.contact.lastName)}</strong>
                          <span className="table-subtext">{provider.businessName}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="location-line">
                        <IconPin className="inline-icon" />
                        {formatLocation(provider.city, provider.neighborhood, provider.countryCode)}
                      </span>
                      <span className="table-subtext">Demande du {formatDate(provider.createdAt)}</span>
                    </td>
                    <td><StatusBadge status={provider.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="success-button" onClick={() => onOpenProvider(provider.id)}>
                          Valider
                        </button>
                        <button type="button" className="ghost-danger-button" onClick={() => onOpenProvider(provider.id)}>
                          Refuser
                        </button>
                        <button type="button" className="icon-only-button" aria-label="Voir le dossier" onClick={() => onOpenProvider(provider.id)}>
                          <IconEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
