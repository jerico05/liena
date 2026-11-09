import type { ProviderStatus } from "./types";

const providerStatusLabels: Record<ProviderStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  SUSPENDED: "Suspendu",
  ARCHIVED: "Archivé",
};

export function providerStatusLabel(status: ProviderStatus): string {
  return providerStatusLabels[status];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
