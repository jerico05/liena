import { useEffect, useState } from "react";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import { formatDate, initials } from "../lib/format";
import type { DashboardResponse, ProviderSummary, StatusFilter } from "../lib/types";
import { IconClipboard, IconEye, IconPin, IconUsers } from "./Icons";
import { KpiGrid } from "./KpiGrid";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";

const emptySummary: ProviderSummary = {
  DRAFT: 0,
  PENDING: 0,
  APPROVED: 0,
  REJECTED: 0,
  SUSPENDED: 0,
  ARCHIVED: 0,
};

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
  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  const maxZoneTotal = Math.max(1, ...(data?.zones.map((zone) => zone.total) ?? [1]));

  return (
    <>
      <PageHeader
        title="Supervision & vetting"
        description="Suivez les inscriptions prestataires et traitez les dossiers en attente."
        actions={
          summary.PENDING > 0 ? (
            <button type="button" className="primary-button" onClick={onOpenValidations}>
              Dossiers à valider ({summary.PENDING})
            </button>
          ) : undefined
        }
      />

      {notice && (
        <p className="form-message form-success notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-message form-error notice" role="alert">
          {error}
        </p>
      )}

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
            value: summary.APPROVED,
            icon: <IconUsers />,
            onClick: () => onOpenStatus("APPROVED"),
          },
          {
            id: "pending",
            label: "Dossiers à valider",
            value: summary.PENDING,
            hint: summary.PENDING > 0 ? "À traiter" : undefined,
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

      {data && data.stalePending > 0 && (
        <div className="callout" role="status">
          <div>
            <strong>{data.stalePending} dossier{data.stalePending > 1 ? "s" : ""} en attente depuis plus de 3 jours</strong>
            <p>Priorisez la modération pour réduire le délai d’activation des prestataires.</p>
          </div>
          <button type="button" className="secondary-button callout-button" onClick={onOpenValidations}>
            Ouvrir la file
          </button>
        </div>
      )}

      <div className="overview-grid dashboard-body">
        <section className="panel dashboard-primary" aria-busy={isLoading}>
          <div className="panel-head panel-head-split">
            <h2>Dossiers à valider en priorité</h2>
            {data && data.queue.length > 0 && (
              <button type="button" className="text-button" onClick={onOpenValidations}>
                Voir tout
              </button>
            )}
          </div>

          {isLoading && !data && (
            <div className="content-loading">
              <p>Chargement du tableau de bord…</p>
            </div>
          )}
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
                          <span className="avatar">{initials(provider.displayName)}</span>
                          <span>
                            <strong>{provider.displayName}</strong>
                            <span className="table-subtext">{provider.categoryLabel}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="location-line">
                          <IconPin className="inline-icon" />
                          {provider.zone}
                        </span>
                        <span className="table-subtext">Demande du {formatDate(provider.createdAt)}</span>
                      </td>
                      <td>
                        <StatusBadge status={provider.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="success-button"
                            onClick={() => onOpenProvider(provider.id)}
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            className="ghost-danger-button"
                            onClick={() => onOpenProvider(provider.id)}
                          >
                            Refuser
                          </button>
                          <button
                            type="button"
                            className="icon-only-button"
                            aria-label="Voir le dossier"
                            onClick={() => onOpenProvider(provider.id)}
                          >
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

        <aside className="dashboard-aside" aria-label="Activité récente">
          <section className="panel">
            <div className="panel-head">
              <h2>Décisions récentes</h2>
            </div>
            {isLoading && !data && <p className="empty-state panel-empty">Chargement…</p>}
            {data && data.recentDecisions.length === 0 && (
              <p className="empty-state panel-empty">Aucune décision récente.</p>
            )}
            {data && data.recentDecisions.length > 0 && (
              <ul className="queue-list">
                {data.recentDecisions.map((provider) => (
                  <li key={provider.id}>
                    <button type="button" className="queue-item" onClick={() => onOpenProvider(provider.id)}>
                      <span className="avatar avatar-sm">{initials(provider.displayName)}</span>
                      <span className="queue-item-copy">
                        <strong>{provider.displayName}</strong>
                        <span className="table-subtext">{provider.zone}</span>
                        <StatusBadge status={provider.status} />
                      </span>
                      <span className="queue-date">{formatDate(provider.updatedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Zones actives</h2>
            </div>
            {isLoading && !data && <p className="empty-state panel-empty">Chargement…</p>}
            {data && data.zones.length === 0 && (
              <p className="empty-state panel-empty">Pas encore de données par zone.</p>
            )}
            {data && data.zones.length > 0 && (
              <ul className="city-list">
                {data.zones.map((zoneRow) => (
                  <li key={zoneRow.zone} className="city-row">
                    <strong>{zoneRow.zone}</strong>
                    <ZoneVolumeBar total={zoneRow.total} max={maxZoneTotal} />
                    <span className="city-count" title="Total prestataires">
                      {zoneRow.total}
                      {zoneRow.pending > 0 && (
                        <span className="city-pending"> · {zoneRow.pending} en attente</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function ZoneVolumeBar({ total, max }: { total: number; max: number }) {
  const width = Math.round((total / max) * 100);
  return (
    <div className="city-track" aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  );
}
