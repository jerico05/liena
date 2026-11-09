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
  const displayName = username.length > 14 ? `${username.slice(0, 14)}…` : username;

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
      <aside className="console-sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src="/assets/liena-logo.png" alt="" />
          <span className="sidebar-brand-text">liena</span>
          <span className="console-tag">Console</span>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          <button
            type="button"
            className={section === "dashboard" ? "sidebar-link active" : "sidebar-link"}
            aria-current={section === "dashboard" ? "page" : undefined}
            aria-label="Tableau de bord"
            onClick={onOpenDashboard}
          >
            <IconLayout className="sidebar-icon" />
            <span>Tableau de bord</span>
          </button>
          <button
            type="button"
            className={section === "validations" ? "sidebar-link active" : "sidebar-link"}
            aria-current={section === "validations" ? "page" : undefined}
            aria-label={`Validations${pendingCount > 0 ? `, ${pendingCount} en attente` : ""}`}
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
            aria-label="Prestataires"
            onClick={onOpenProviders}
          >
            <IconUsers className="sidebar-icon" />
            <span>Prestataires</span>
          </button>
        </nav>

        <button
          type="button"
          className="sidebar-logout"
          aria-label="Déconnexion"
          onClick={handleLogout}
          disabled={isSubmitting}
        >
          <IconLogout className="sidebar-icon" />
          <span>Déconnexion</span>
        </button>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <h1>{title}</h1>
          <div className="topbar-user">
            <span className="topbar-avatar">{displayName.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{displayName}</strong>
              <span>Administrateur</span>
            </span>
          </div>
        </header>

        <main className="console-content">
          {error && <p className="form-message form-error notice" role="alert">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
