import { useState, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { IconClipboard, IconLayout, IconLogout, IconUsers } from "./Icons";

export type ConsoleSection = "dashboard" | "validations" | "providers";

type AdminShellProps = {
  username: string;
  section: ConsoleSection;
  title: string;
  pendingCount: number;
  onLogout: () => Promise<void>;
  onOpenDashboard: () => void;
  onOpenValidations: () => void;
  onOpenProviders: () => void;
  children: ReactNode;
};

const sectionLabels: Record<ConsoleSection, string> = {
  dashboard: "Tableau de bord",
  validations: "Validations",
  providers: "Prestataires",
};

export function AdminShell({
  username,
  section,
  title,
  pendingCount,
  onLogout,
  onOpenDashboard,
  onOpenValidations,
  onOpenProviders,
  children,
}: AdminShellProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const displayName = username.length > 18 ? `${username.slice(0, 18)}…` : username;

  async function handleLogout() {
    setError("");
    setIsSubmitting(true);
    try {
      await onLogout();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "La déconnexion a échoué.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="console-layout">
      <aside className="console-sidebar" aria-label="Menu latéral">
        <div className="sidebar-brand">
          <img className="brand-logo" src="/assets/liena-logo.png" alt="" />
          <div className="sidebar-brand-copy">
            <span className="sidebar-brand-text">liena</span>
            <span className="console-tag">Console admin</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          <button
            type="button"
            className={section === "dashboard" ? "sidebar-link active" : "sidebar-link"}
            aria-current={section === "dashboard" ? "page" : undefined}
            onClick={onOpenDashboard}
          >
            <IconLayout className="sidebar-icon" />
            <span>Tableau de bord</span>
          </button>
          <button
            type="button"
            className={section === "validations" ? "sidebar-link active" : "sidebar-link"}
            aria-current={section === "validations" ? "page" : undefined}
            onClick={onOpenValidations}
          >
            <IconClipboard className="sidebar-icon" />
            <span>Validations</span>
            {pendingCount > 0 && <span className="sidebar-badge">{pendingCount}</span>}
          </button>
          <button
            type="button"
            className={section === "providers" ? "sidebar-link active" : "sidebar-link"}
            aria-current={section === "providers" ? "page" : undefined}
            onClick={onOpenProviders}
          >
            <IconUsers className="sidebar-icon" />
            <span>Prestataires</span>
          </button>
        </nav>

        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
          disabled={isSubmitting}
        >
          <IconLogout className="sidebar-icon" />
          <span>{isSubmitting ? "Déconnexion…" : "Déconnexion"}</span>
        </button>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <nav className="topbar-breadcrumb" aria-label="Fil d’Ariane">
            <span className="topbar-breadcrumb-root">Liena</span>
            <span className="topbar-breadcrumb-sep" aria-hidden="true">
              /
            </span>
            <span className="topbar-breadcrumb-muted">{sectionLabels[section]}</span>
            {title !== sectionLabels[section] && (
              <>
                <span className="topbar-breadcrumb-sep" aria-hidden="true">
                  /
                </span>
                <span className="topbar-breadcrumb-current">{title}</span>
              </>
            )}
          </nav>

          <div className="topbar-user">
            <div className="topbar-user-copy">
              <strong>{displayName}</strong>
              <span>Administrateur</span>
            </div>
            <span className="topbar-avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="console-content">
          {error && (
            <p className="form-message form-error notice" role="alert">
              {error}
            </p>
          )}
          <div className="page-stack">{children}</div>
        </main>
      </div>
    </div>
  );
}
