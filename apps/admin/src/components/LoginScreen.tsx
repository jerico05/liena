import { useState, type FormEvent } from "react";
import { ApiError, apiRequest, ensureCsrf } from "../lib/api";
import type { SessionResponse } from "../lib/types";
import { IconLock, IconShield, IconUser } from "./Icons";

type LoginScreenProps = {
  bootError?: string;
  onSuccess: (username: string) => void;
};

export function LoginScreen({ bootError, onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(bootError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await ensureCsrf();
      const session = await apiRequest<SessionResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ username, password, rememberDevice }),
      });
      onSuccess(session.data.username);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "L’API d’administration est injoignable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-teal" />
      <p className="security-indicator"><span /> Connexion sécurisée</p>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-heading">
          <div className="brand">
            <img className="brand-logo" src="/assets/liena-logo.png" alt="Liena" />
          </div>
          <p className="role-pill"><span>●</span> Console</p>
          <h1 id="login-title">Espace de gestion</h1>
          <p>Connectez-vous pour consulter les prestataires et valider leurs demandes.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="username">Nom d’utilisateur</label>
            <div className="input-wrap">
              <IconUser className="field-icon" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                required
                maxLength={64}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="password">Mot de passe</label>
            </div>
            <div className="input-wrap">
              <IconLock className="field-icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>
          <label className="remember-option">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            Mémoriser cet appareil
          </label>
          <p className="hint">Session de 12 heures, ou 30 jours sur cet appareil.</p>
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="card-security"><span><IconShield /></span></p>
      </section>
      <p className="page-footer">Liena · Accès réservé à l’équipe d’administration</p>
    </main>
  );
}
