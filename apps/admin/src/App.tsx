import { useCallback, useEffect, useState } from "react";
import { AdminShell, type ConsoleSection } from "./components/AdminShell";
import { DashboardHome } from "./components/DashboardHome";
import { LoginScreen } from "./components/LoginScreen";
import { ProviderBoard } from "./components/ProviderBoard";
import { ProviderDetail } from "./components/ProviderDetail";
import { ApiError, apiRequest, ensureCsrf } from "./lib/api";
import type { DashboardResponse, SessionResponse, StatusFilter } from "./lib/types";

type View =
  | { name: "dashboard" }
  | { name: "validations" }
  | { name: "providers"; status: StatusFilter }
  | { name: "detail"; providerId: string; from: ConsoleSection; status: StatusFilter };

export function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [bootError, setBootError] = useState("");
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [notice, setNotice] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    ensureCsrf()
      .then(() => apiRequest<SessionResponse>("/me", { signal: controller.signal }))
      .then((session) => setUsername(session.data.username))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setUsername(null);
        if (!(error instanceof ApiError) || error.status !== 401) {
          setBootError(error instanceof Error ? error.message : "L’API d’administration est injoignable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsReady(true);
      });
    return () => controller.abort();
  }, []);

  const refreshPendingCount = useCallback(() => {
    if (!username) return;
    apiRequest<DashboardResponse>("/dashboard")
      .then((body) => setPendingCount(body.data.summary.PENDING))
      .catch(() => setPendingCount(0));
  }, [username]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount, notice, view.name]);

  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: "Tableau de bord",
      validations: "Validations",
      providers: "Prestataires",
      detail: "Fiche prestataire",
    };
    const key = view.name === "detail" ? "detail" : view.name;
    document.title = username
      ? `${titles[key]} · Liena Console`
      : "Connexion · Liena Console";
  }, [username, view]);

  const handleUnauthorized = useCallback(() => {
    setUsername(null);
    setView({ name: "dashboard" });
    setPendingCount(0);
    setBootError("Votre session a expiré. Connectez-vous à nouveau.");
  }, []);

  if (!isReady) {
    return (
      <main className="page-shell">
        <p className="loading-message">Vérification de la session…</p>
      </main>
    );
  }

  if (!username) return <LoginScreen bootError={bootError} onSuccess={setUsername} />;

  async function handleLogout() {
    await apiRequest("/logout", { method: "POST" });
    setUsername(null);
    setView({ name: "dashboard" });
    setNotice("");
    setPendingCount(0);
  }

  const section: ConsoleSection =
    view.name === "validations"
      ? "validations"
      : view.name === "providers" || (view.name === "detail" && view.from === "providers")
        ? "providers"
        : view.name === "detail" && view.from === "validations"
          ? "validations"
          : "dashboard";
  const pageTitle =
    view.name === "detail"
      ? "Fiche prestataire"
      : view.name === "validations"
        ? "Validations"
        : view.name === "providers"
          ? "Prestataires"
          : "Tableau de bord";

  return (
    <AdminShell
      username={username}
      section={section}
      title={pageTitle}
      pendingCount={pendingCount}
      onLogout={handleLogout}
      onOpenDashboard={() => {
        setNotice("");
        setView({ name: "dashboard" });
      }}
      onOpenValidations={() => {
        setNotice("");
        setView({ name: "validations" });
      }}
      onOpenProviders={() => {
        setNotice("");
        setView({ name: "providers", status: "ALL" });
      }}
    >
      {view.name === "dashboard" && (
        <DashboardHome
          notice={notice}
          onUnauthorized={handleUnauthorized}
          onOpenValidations={() => setView({ name: "validations" })}
          onOpenStatus={(status) => setView({ name: "providers", status })}
          onOpenProvider={(providerId) =>
            setView({ name: "detail", providerId, from: "dashboard", status: "PENDING" })
          }
        />
      )}
      {view.name === "validations" && (
        <ProviderBoard
          key="validations"
          title="Validations en attente"
          description="Traitez les dossiers prestataires avant leur mise en ligne."
          showKpis={false}
          lockStatus
          initialStatus="PENDING"
          notice={notice}
          onUnauthorized={handleUnauthorized}
          onOpen={(providerId) => {
            setNotice("");
            setView({ name: "detail", providerId, from: "validations", status: "PENDING" });
          }}
        />
      )}
      {view.name === "providers" && (
        <ProviderBoard
          key={view.status}
          initialStatus={view.status}
          notice={notice}
          onUnauthorized={handleUnauthorized}
          onOpen={(providerId) => {
            setNotice("");
            setView({ name: "detail", providerId, from: "providers", status: view.status });
          }}
        />
      )}
      {view.name === "detail" && (
        <ProviderDetail
          providerId={view.providerId}
          onUnauthorized={handleUnauthorized}
          onBack={() => {
            if (view.from === "dashboard") setView({ name: "dashboard" });
            else if (view.from === "validations") setView({ name: "validations" });
            else setView({ name: "providers", status: view.status });
          }}
          onReviewed={(message) => {
            setNotice(message);
            refreshPendingCount();
            if (view.from === "dashboard") setView({ name: "dashboard" });
            else if (view.from === "validations") setView({ name: "validations" });
            else setView({ name: "providers", status: view.status });
          }}
        />
      )}
    </AdminShell>
  );
}
