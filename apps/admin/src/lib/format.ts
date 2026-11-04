import type { AccountStatus, PricingType, ProviderStatus, ServiceStatus } from "./types";

const providerStatusLabels: Record<ProviderStatus, string> = {
  PENDING: "En attente",
  VERIFIED: "Vérifié",
  REJECTED: "Refusé",
  SUSPENDED: "Suspendu",
};

const accountStatusLabels: Record<AccountStatus, string> = {
  ACTIVE: "Compte actif",
  SUSPENDED: "Compte suspendu",
  DELETED: "Compte supprimé",
};

const serviceStatusLabels: Record<ServiceStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  PAUSED: "En pause",
  ARCHIVED: "Archivée",
};

const countries: Record<string, string> = {
  TG: "Togo",
  BJ: "Bénin",
  CI: "Côte d’Ivoire",
  GH: "Ghana",
  BF: "Burkina Faso",
  SN: "Sénégal",
  FR: "France",
};

export function providerStatusLabel(status: ProviderStatus): string {
  return providerStatusLabels[status];
}

export function accountStatusLabel(status: AccountStatus): string {
  return accountStatusLabels[status];
}

export function serviceStatusLabel(status: ServiceStatus): string {
  return serviceStatusLabels[status];
}

export function formatCountry(countryCode: string): string {
  return countries[countryCode] ?? countryCode;
}

export function formatLocation(city: string, neighborhood: string | null, countryCode: string): string {
  const place = neighborhood ? `${neighborhood}, ${city}` : city;
  return `${place} · ${formatCountry(countryCode)}`;
}

export function formatPerson(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatMoney(amount: string | null, currency: string, pricingType: PricingType): string {
  if (pricingType === "QUOTE" || amount === null) return "Sur devis";
  let formatted = amount;
  try {
    formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    formatted = `${amount} ${currency}`;
  }
  if (pricingType === "HOURLY") return `${formatted} / heure`;
  if (pricingType === "DAILY") return `${formatted} / jour`;
  return formatted;
}

export function mapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}
