import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

const API_ROOT = `${(import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "")}/admin`;

type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  expiresAt: string;
  createdAt: string;
};

type ApiErrorBody = {
  error?: { message?: string };
};

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (csrfToken && options.method && !["GET", "HEAD", "OPTIONS"].includes(options.method)) {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiError(errorBody.error?.message ?? "Une erreur est survenue. Réessayez.", response.status);
  }
  return payload as T;
}

function isSuperAdmin(user: AdminUser): boolean {
  return user.roles.includes("SUPER_ADMIN");
}

function readAdminRole(value: string): "ADMIN" | "SUPER_ADMIN" {
  return value === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Jamais";
}

export function AdminApp() {
  const [route, setRoute] = useState(window.location.pathname);
  const [csrfToken, setCsrfToken] = useState("");
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState("");

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const csrf = await apiRequest<{ csrfToken: string }>("/csrf");
        if (!active) return;
        setCsrfToken(csrf.csrfToken);

        try {
          const session = await apiRequest<{ data: AdminUser; csrfToken: string }>("/me");
          if (!active) return;
          setAdmin(session.data);
          if (session.csrfToken) setCsrfToken(session.csrfToken);
        } catch (error) {
          if (error instanceof ApiError && error.status !== 401) {
            setBootError(error.message);
          } else if (!(error instanceof ApiError)) {
            setBootError("La session n’a pas pu être vérifiée. Actualisez la page.");
          }
        }
      } catch {
        if (active) {
          setBootError("Le serveur est momentanément inaccessible. Vérifiez votre connexion.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await apiRequest("/logout", { method: "POST" }, csrfToken);
    setAdmin(null);
    setCsrfToken("");
    navigate("/");
  };
  const handleSessionExpired = useCallback(() => setAdmin(null), []);

  if (loading) {
    return <main className="page-shell"><p className="loading-message">Chargement de la console…</p></main>;
  }

  if (admin) {
    return (
      <AdminDashboard
        admin={admin}
        csrfToken={csrfToken}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
      />
    );
  }

  if (route === "/setup") {
    return <InvitationSetup csrfToken={csrfToken} onNavigate={navigate} />;
  }
  if (route === "/forgot-password") {
    return <ForgotPassword csrfToken={csrfToken} onNavigate={navigate} />;
  }
  if (route === "/reset-password") {
    return <ResetPassword csrfToken={csrfToken} onNavigate={navigate} />;
  }

  return (
    <LoginPage
      csrfToken={csrfToken}
      initialError={bootError}
      onAuthenticated={setAdmin}
      onNavigate={navigate}
    />
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <img className="brand-logo" src="/assets/liena-logo.png" alt="Liena" />
    </div>
  );
}

function AuthLayout({
  children,
  footer = true,
}: {
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <main className="page-shell">
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="ambient ambient-teal" aria-hidden="true" />
      <div className="security-indicator"><span />Accès sécurisé</div>
      <section className="auth-card">{children}</section>
      {footer && <footer className="page-footer">© 2026 Liena · Respect de la confidentialité et des données.</footer>}
    </main>
  );
}

function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="auth-heading">
      <Brand />
      <div className="role-pill"><span aria-hidden="true">✦</span>Espace Super Admin</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function LoginPage({
  csrfToken,
  initialError,
  onAuthenticated,
  onNavigate,
}: {
  csrfToken: string;
  initialError: string;
  onAuthenticated: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest<{ data: AdminUser }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberDevice }),
      }, csrfToken);
      onAuthenticated(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Connexion administrateur" subtitle="Accédez à la console de gestion et de supervision Liena." />
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="login-email"><span>Adresse e-mail</span><span className="required-note">Requis</span></label>
          <div className="input-wrap">
            <span className="field-icon" aria-hidden="true">✉</span>
            <input id="login-email" type="email" autoComplete="username" required maxLength={254}
              placeholder="ex. admin@liena.fr" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <div className="field">
          <div className="field-label-row">
            <label htmlFor="login-password">Mot de passe</label>
            <button type="button" className="text-button" onClick={() => onNavigate("/forgot-password")}>Mot de passe oublié ?</button>
          </div>
          <div className="input-wrap">
            <span className="field-icon" aria-hidden="true">⌑</span>
            <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password"
              required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="password-toggle" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Masquer" : "Voir"}</button>
          </div>
        </div>
        <label className="remember-option">
          <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />
          <span>Mémoriser cet appareil pendant 30 jours</span>
        </label>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy || !csrfToken}>
          {busy ? "Connexion…" : "Se connecter à la console"} <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="card-security" aria-label="Connexion protégée">
        <span aria-hidden="true">⛨</span>
      </div>
    </AuthLayout>
  );
}

function InvitationSetup({
  csrfToken,
  onNavigate,
}: {
  csrfToken: string;
  onNavigate: (path: string) => void;
}) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ data: { message: string } }>("/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token, firstName, lastName, password }),
      }, csrfToken);
      setMessage(result.data.message);
      window.history.replaceState({}, "", "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer le compte.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Créer votre accès" subtitle="Finalisez votre invitation à l’espace d’administration Liena." />
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="field"><label htmlFor="first-name">Prénom</label><input id="first-name" autoComplete="given-name" required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
          <div className="field"><label htmlFor="last-name">Nom</label><input id="last-name" autoComplete="family-name" required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
          <div className="field"><label htmlFor="setup-password">Mot de passe <span className="hint">(12 caractères minimum)</span></label><input id="setup-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="field"><label htmlFor="confirm-password">Confirmer le mot de passe</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {message && <p className="form-message form-success" role="status">{message}</p>}
          <button className="primary-button" disabled={busy || !csrfToken}>{busy ? "Création…" : "Activer mon compte"} <span aria-hidden="true">→</span></button>
        </form>
      ) : <p className="form-message form-error" role="alert">Le lien d’invitation est absent ou incomplet.</p>}
      <button className="back-link" type="button" onClick={() => onNavigate("/")}>Retour à la connexion</button>
    </AuthLayout>
  );
}

function ForgotPassword({
  csrfToken,
  onNavigate,
}: {
  csrfToken: string;
  onNavigate: (path: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest<{ data: { message: string } }>("/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      }, csrfToken);
      setMessage(result.data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demande impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Mot de passe oublié" subtitle="Nous vous enverrons un lien sécurisé si un compte correspond à cette adresse." />
      <form className="auth-form" onSubmit={submit}>
        <div className="field"><label htmlFor="recovery-email">Adresse e-mail</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        {message && <p className="form-message form-success" role="status">{message}</p>}
        <button className="primary-button" disabled={busy || !csrfToken}>{busy ? "Envoi…" : "Recevoir un lien de réinitialisation"} <span aria-hidden="true">→</span></button>
      </form>
      <button className="back-link" type="button" onClick={() => onNavigate("/")}>Retour à la connexion</button>
    </AuthLayout>
  );
}

function ResetPassword({
  csrfToken,
  onNavigate,
}: {
  csrfToken: string;
  onNavigate: (path: string) => void;
}) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ data: { message: string } }>("/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }, csrfToken);
      setMessage(result.data.message);
      window.history.replaceState({}, "", "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte administrateur." />
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="field"><label htmlFor="new-password">Nouveau mot de passe <span className="hint">(12 caractères minimum)</span></label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="field"><label htmlFor="new-password-confirm">Confirmer le mot de passe</label><input id="new-password-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {message && <p className="form-message form-success" role="status">{message}</p>}
          <button className="primary-button" disabled={busy || !csrfToken}>{busy ? "Mise à jour…" : "Mettre à jour le mot de passe"} <span aria-hidden="true">→</span></button>
        </form>
      ) : <p className="form-message form-error" role="alert">Le lien de réinitialisation est absent ou incomplet.</p>}
      <button className="back-link" type="button" onClick={() => onNavigate("/")}>Retour à la connexion</button>
    </AuthLayout>
  );
}

function AdminDashboard({
  admin,
  csrfToken,
  onLogout,
  onSessionExpired,
}: {
  admin: AdminUser;
  csrfToken: string;
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  async function confirmSignOut() {
    setLogoutError("");
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "La déconnexion a échoué.");
    } finally {
      setConfirmLogout(false);
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><Brand compact /><span>liena</span></div>
        <nav className="admin-nav" aria-label="Navigation principale">
          <p className="admin-nav-heading">Supervision</p>
          <AdminNavButton section="dashboard" activeSection={activeSection} onSelect={setActiveSection} />
          <AdminNavButton section="requests" activeSection={activeSection} onSelect={setActiveSection} badge="0" />
          <AdminNavButton section="providers" activeSection={activeSection} onSelect={setActiveSection} />
          <AdminNavButton section="billing" activeSection={activeSection} onSelect={setActiveSection} />
          <AdminNavButton section="compliance" activeSection={activeSection} onSelect={setActiveSection} />
        </nav>
        <nav className="admin-nav admin-nav-bottom" aria-label="Aide et paramètres">
          <AdminNavButton section="settings" activeSection={activeSection} onSelect={setActiveSection} />
          <AdminNavButton section="help" activeSection={activeSection} onSelect={setActiveSection} />
          <button className="admin-nav-link" type="button" onClick={() => setConfirmLogout(true)}>
            <AdminIcon name="logout" /><span>Déconnexion</span>
          </button>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Supervision</h1>
          <label className="admin-search">
            <AdminIcon name="search" />
            <input aria-label="Rechercher" placeholder="Rechercher un dossier, SIRET, nom…" />
          </label>
          <div className="admin-profile">
            <span className="dashboard-avatar" aria-hidden="true">{admin.firstName.slice(0, 1)}{admin.lastName.slice(0, 1)}</span>
            <div><strong>{admin.firstName} {admin.lastName}</strong><span>{isSuperAdmin(admin) ? "Super Admin" : "Admin"}</span></div>
          </div>
        </header>

        <section className="admin-page">
          {logoutError && <p className="form-message form-error" role="alert">{logoutError}</p>}
          {activeSection === "dashboard" ? (
            <AdminOverview />
          ) : activeSection === "settings" ? (
            isSuperAdmin(admin) ? (
              <AdminManagement csrfToken={csrfToken} onSessionExpired={onSessionExpired} />
            ) : (
              <section className="admin-empty-page">
                <h2>Paramètres</h2>
                <p>La gestion des comptes est réservée au super-administrateur.</p>
              </section>
            )
          ) : (
            <AdminEmptySection section={activeSection} />
          )}
        </section>
      </div>
      {confirmLogout && (
        <ConfirmDialog
          title="Confirmer la déconnexion"
          description="Voulez-vous vraiment vous déconnecter de votre espace d’administration ?"
          confirmLabel="Oui, me déconnecter"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => void confirmSignOut()}
        />
      )}
    </main>
  );
}

type AdminSection = "dashboard" | "requests" | "providers" | "billing" | "compliance" | "settings" | "help";
type AdminIconName = "dashboard" | "requests" | "providers" | "billing" | "compliance" | "settings" | "help" | "logout" | "search";

const adminSections: Record<AdminSection, { label: string; icon: AdminIconName }> = {
  dashboard: { label: "Tableau de bord", icon: "dashboard" },
  requests: { label: "Demandes", icon: "requests" },
  providers: { label: "Prestataires", icon: "providers" },
  billing: { label: "Facturation", icon: "billing" },
  compliance: { label: "Conformité", icon: "compliance" },
  settings: { label: "Paramètres", icon: "settings" },
  help: { label: "Centre d’aide", icon: "help" },
};

function AdminIcon({ name }: { name: AdminIconName }) {
  const paths: Record<AdminIconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    requests: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /><path d="M9 3V2m6 1V2" /></>,
    providers: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    billing: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3" /><path d="M7 3V1m10 2V1" /></>,
    compliance: <><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.8c-1.2 1.2-1.9 1.3-1.9 3" /><path d="M12 17h.01" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  };

  return <svg className="admin-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function AdminNavButton({
  section,
  activeSection,
  onSelect,
  badge,
}: {
  section: AdminSection;
  activeSection: AdminSection;
  onSelect: (section: AdminSection) => void;
  badge?: string;
}) {
  const item = adminSections[section];
  return (
    <button
      className={`admin-nav-link ${activeSection === section ? "is-active" : ""}`}
      type="button"
      aria-label={item.label}
      aria-current={activeSection === section ? "page" : undefined}
      onClick={() => onSelect(section)}
    >
      <AdminIcon name={item.icon} />
      <span>{item.label}</span>
      {badge !== undefined && <span className="admin-nav-badge">{badge}</span>}
    </button>
  );
}

function AdminOverview() {
  const stats = [
    { label: "Total Prestataires", icon: "providers" as const },
    { label: "Dossiers Validés", icon: "compliance" as const },
    { label: "En attente (Vetting)", icon: "requests" as const },
    { label: "Refusés / Expirés", icon: "billing" as const },
  ];

  return (
    <>
      <div className="admin-stats" aria-label="Indicateurs de supervision">
        {stats.map((stat) => (
          <article className="admin-stat-card" key={stat.label}>
            <div><span>{stat.label}</span><strong>0</strong></div>
            <span className="admin-stat-icon"><AdminIcon name={stat.icon} /></span>
          </article>
        ))}
      </div>

      <div className="admin-table-toolbar">
        <label className="admin-filter-search">
          <AdminIcon name="search" />
          <input aria-label="Filtrer les dossiers" placeholder="Filtrer par nom, SIRET, spécialité…" />
        </label>
        <div className="admin-filters" aria-label="Filtres des dossiers">
          <select aria-label="Statut" defaultValue="all" disabled><option value="all">Statut : Tous</option></select>
          <select aria-label="Métier" defaultValue="all" disabled><option value="all">Métier : Tous</option></select>
          <select aria-label="Date" defaultValue="recent" disabled><option value="recent">Date : Récentes</option></select>
        </div>
      </div>

      <section className="admin-records-card" aria-labelledby="recent-records-heading">
        <div className="admin-table-scroll">
          <table className="admin-records-table">
            <thead>
              <tr>
                <th scope="col"><input type="checkbox" aria-label="Sélectionner tous les dossiers" disabled /></th>
                <th scope="col">N° dossier</th>
                <th scope="col">Professionnel</th>
                <th scope="col">Métier & spécialité</th>
                <th scope="col">Zone d’intervention</th>
                <th scope="col">Date & heure</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={7}>
                <div className="admin-no-records">
                  <h2 id="recent-records-heading">Aucun dossier</h2>
                  <p>Les dossiers apparaîtront ici lorsqu’ils seront disponibles.</p>
                </div>
              </td></tr>
            </tbody>
          </table>
        </div>
        <div className="admin-table-pagination" aria-label="Pagination">
          <span>0 dossier</span>
          <button type="button" disabled aria-label="Page précédente">‹</button>
          <span>0</span>
          <button type="button" disabled aria-label="Page suivante">›</button>
        </div>
      </section>
    </>
  );
}

function AdminEmptySection({ section }: { section: AdminSection }) {
  const { label } = adminSections[section];
  return (
    <section className="admin-empty-page">
      <h2>{label}</h2>
      <p>Aucune donnée disponible pour le moment.</p>
    </section>
  );
}

function AdminManagement({
  csrfToken,
  onSessionExpired,
}: {
  csrfToken: string;
  onSessionExpired: () => void;
}) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminUser | null>(null);

  const reload = useCallback(async () => {
    const [adminResult, invitationResult] = await Promise.all([
      apiRequest<{ data: AdminUser[] }>("/admins"),
      apiRequest<{ data: Invitation[] }>("/invitations"),
    ]);
    setAdmins(adminResult.data);
    setInvitations(invitationResult.data);
  }, []);

  useEffect(() => {
    void reload().catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : "Chargement impossible.";
      setError(message);
      if (caught instanceof ApiError && caught.status === 401) onSessionExpired();
    });
  }, [reload, onSessionExpired]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await apiRequest("/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }, csrfToken);
      setEmail("");
      setMessage("Invitation envoyée. Elle expirera dans 48 heures.");
      await reload();
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "L’invitation n’a pas pu être envoyée.";
      setError(text);
      if (caught instanceof ApiError && caught.status === 401) onSessionExpired();
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(admin: AdminUser, nextRole: "ADMIN" | "SUPER_ADMIN") {
    setError("");
    try {
      await apiRequest(`/admins/${admin.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      }, csrfToken);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification du rôle impossible.");
    }
  }

  async function removeAdmin(admin: AdminUser) {
    setError("");
    try {
      await apiRequest(`/admins/${admin.id}`, { method: "DELETE" }, csrfToken);
      setRemoving(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retrait des accès impossible.");
      setRemoving(null);
    }
  }

  async function revokeInvitation(invitation: Invitation) {
    setError("");
    try {
      await apiRequest(`/invitations/${invitation.id}`, { method: "DELETE" }, csrfToken);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Révocation impossible.");
    }
  }

  return (
    <div className="management-grid">
      {error && <p className="form-message form-error grid-full" role="alert">{error}</p>}
      {message && <p className="form-message form-success grid-full" role="status">{message}</p>}
      <section className="dashboard-card invite-card">
        <div className="section-heading"><div><span className="eyebrow">ACCÈS SÉCURISÉ</span><h2>Inviter un administrateur</h2></div><span className="section-icon" aria-hidden="true">＋</span></div>
        <p>Une invitation à usage unique sera envoyée par e-mail. Elle expire après 48 heures.</p>
        <form className="invite-form" onSubmit={invite}>
          <div className="field"><label htmlFor="invite-email">Adresse e-mail</label><input id="invite-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@entreprise.fr" /></div>
          <div className="field"><label htmlFor="invite-role">Rôle</label><select id="invite-role" value={role} onChange={(event) => setRole(readAdminRole(event.target.value))}><option value="ADMIN">Administrateur</option><option value="SUPER_ADMIN">Super administrateur</option></select></div>
          <button className="primary-button" disabled={busy || !csrfToken}>{busy ? "Envoi…" : "Envoyer l’invitation"} <span aria-hidden="true">→</span></button>
        </form>
      </section>

      <section className="dashboard-card admins-card">
        <div className="section-heading"><div><span className="eyebrow">COMPTES ACTIFS</span><h2>Administrateurs</h2></div><span className="count-badge">{admins.length}</span></div>
        {admins.length ? (
          <div className="table-scroll"><table><thead><tr><th>Administrateur</th><th>Rôle</th><th>Dernière connexion</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{admins.map((item) => <tr key={item.id}>
              <td><strong>{item.firstName} {item.lastName}</strong><span className="table-subtext">{item.email}</span></td>
              <td><select aria-label={`Rôle de ${item.firstName} ${item.lastName}`} value={item.roles.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : "ADMIN"} onChange={(event) => void updateRole(item, readAdminRole(event.target.value))}><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select></td>
              <td>{formatDate(item.lastLoginAt)}</td>
              <td><button className="icon-button danger-text" aria-label={`Retirer les accès de ${item.firstName} ${item.lastName}`} title="Retirer les accès admin" onClick={() => setRemoving(item)}>Retirer</button></td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="empty-state">Aucun compte administrateur trouvé.</p>}
      </section>

      <section className="dashboard-card invitations-card">
        <div className="section-heading"><div><span className="eyebrow">EN ATTENTE</span><h2>Invitations en cours</h2></div><span className="count-badge">{invitations.length}</span></div>
        {invitations.length ? <ul className="invitation-list">{invitations.map((invitation) => <li key={invitation.id}>
          <div><strong>{invitation.email}</strong><span>{invitation.role === "SUPER_ADMIN" ? "Super administrateur" : "Administrateur"} · expire le {formatDate(invitation.expiresAt)}</span></div>
          <button className="text-button danger-text" onClick={() => void revokeInvitation(invitation)}>Révoquer</button>
        </li>)}</ul> : <p className="empty-state">Aucune invitation en attente.</p>}
      </section>

      {removing && <ConfirmDialog title="Retirer les accès administrateur ?" description={`Le compte ${removing.email} sera déconnecté de toutes ses sessions d’administration.`} confirmLabel="Retirer les accès" destructive onCancel={() => setRemoving(null)} onConfirm={() => void removeAdmin(removing)} />}
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <div className="dialog-symbol" aria-hidden="true">{destructive ? "!" : "↗"}</div>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="dialog-actions">
        <button className="secondary-button" autoFocus onClick={onCancel}>Annuler</button>
        <button className={destructive ? "danger-button" : "primary-button"} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
