import { useEffect, useState } from "react";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import { formatLocation, formatPerson, initials } from "../lib/format";
import type { ProviderListResponse, ProviderSummary, StatusFilter } from "../lib/types";
import { IconEye, IconPin, IconSearch, IconUsers } from "./Icons";
import { KpiGrid } from "./KpiGrid";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";

const emptySummary: ProviderSummary = { pending: 0, verified: 0, rejected: 0, suspended: 0 };

type ProviderBoardProps = {
  title?: string;
  description?: string;
  showKpis?: boolean;
  lockStatus?: boolean;
  initialStatus?: StatusFilter;
  notice?: string;
  onOpen: (providerId: string) => void;
  onUnauthorized: () => void;
};

export function ProviderBoard({
  title = "Annuaire des prestataires",
  description = "Consultez les profils, leur zone d’intervention et leur statut de validation.",
  showKpis = true,
  lockStatus = false,
  initialStatus = "ALL",
  notice,
  onOpen,
  onUnauthorized,
}: ProviderBoardProps) {
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProviderListResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStatus(initialStatus);
    setPage(1);
  }, [initialStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch) params.set("q", debouncedSearch);

    setIsLoading(true);
    apiRequest<ProviderListResponse>(`/providers?${params.toString()}`, { signal: controller.signal })
      .then((body) => {
        setResult(body);
        setError("");
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Impossible de charger les prestataires.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [status, debouncedSearch, page, onUnauthorized]);

  const summary = result?.summary ?? emptySummary;
  const total = result?.pagination.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (result?.pagination.pageSize ?? 20)));
  const pageSize = result?.pagination.pageSize ?? 20;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <>
      <PageHeader title={title} description={description} />

      {notice && <p className="form-message form-success notice" role="status">{notice}</p>}
      {error && <p className="form-message form-error notice" role="alert">{error}</p>}

      {showKpis && <KpiGrid
        items={[
          {
            id: "all",
            label: "Enregistrés",
            value: summary.pending + summary.verified + summary.rejected + summary.suspended,
            icon: <IconUsers />,
          },
          {
            id: "verified",
            label: "Vérifiés",
            value: summary.verified,
            icon: <IconUsers />,
            onClick: () => chooseStatus("VERIFIED"),
          },
          {
            id: "pending",
            label: "En attente",
            value: summary.pending,
            hint: summary.pending > 0 ? "À traiter" : undefined,
            icon: <IconUsers />,
            onClick: () => chooseStatus("PENDING"),
          },
          {
            id: "suspended",
            label: "Suspendus",
            value: summary.suspended,
            icon: <IconUsers />,
            onClick: () => chooseStatus("SUSPENDED"),
          },
        ]}
      />}

      <section className="panel" aria-busy={isLoading}>
        <div className="filter-bar">
          <label className="search-field search-field-wide">
            <span className="sr-only">Rechercher</span>
            <IconSearch className="field-icon" />
            <input
              type="search"
              placeholder="Rechercher par nom, e-mail, téléphone ou ville"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {!lockStatus && (
            <label className="select-field">
              <span className="sr-only">Statut</span>
              <select
                value={status}
                onChange={(event) => chooseStatus(event.target.value as StatusFilter)}
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PENDING">En attente de validation</option>
                <option value="VERIFIED">Vérifiés</option>
                <option value="REJECTED">Refusés</option>
                <option value="SUSPENDED">Suspendus</option>
              </select>
            </label>
          )}
        </div>

        {isLoading && !result && <p className="empty-state panel-empty">Chargement…</p>}
        {result && result.data.length === 0 && (
          <p className="empty-state panel-empty">Aucun prestataire ne correspond à votre recherche.</p>
        )}
        {result && result.data.length > 0 && (
          <div className="table-scroll">
            <table className="table-console">
              <caption className="sr-only">Liste des prestataires</caption>
              <thead>
                <tr>
                  <th scope="col">Prestataire</th>
                  <th scope="col" className="hide-sm">Contact</th>
                  <th scope="col">Zone</th>
                  <th scope="col">Statut</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((provider) => (
                  <tr key={provider.id}>
                    <td>
                      <div className="identity">
                        <span className="avatar">{initials(provider.contact.firstName, provider.contact.lastName)}</span>
                        <span>
                          <strong>{provider.businessName}</strong>
                          <span className="table-subtext">{formatPerson(provider.contact.firstName, provider.contact.lastName)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="hide-sm">
                      {provider.contact.email}
                      <span className="table-subtext">{provider.contact.phone ?? "—"}</span>
                    </td>
                    <td>
                      <span className="location-line">
                        <IconPin className="inline-icon" />
                        {formatLocation(provider.city, provider.neighborhood, provider.countryCode)}
                      </span>
                    </td>
                    <td><StatusBadge status={provider.status} /></td>
                    <td>
                      <button type="button" className="icon-only-button" aria-label="Voir le dossier" onClick={() => onOpen(provider.id)}>
                        <IconEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <footer className="panel-footer">
            <span>Affichage de {from} à {to} sur {total} prestataires</span>
            <div className="pager">
              <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Précédent
              </button>
              <span>{page} / {pageCount}</span>
              <button type="button" className="secondary-button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
                Suivant
              </button>
            </div>
          </footer>
        )}
      </section>
    </>
  );

  function chooseStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }
}
