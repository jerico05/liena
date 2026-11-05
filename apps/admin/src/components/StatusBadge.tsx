import { accountStatusLabel, providerStatusLabel, serviceStatusLabel } from "../lib/format";
import type { AccountStatus, ProviderStatus, ServiceStatus } from "../lib/types";

export function StatusBadge({ status }: { status: ProviderStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{providerStatusLabel(status)}</span>;
}

export function AccountBadge({ status }: { status: AccountStatus }) {
  return <span className={`badge badge-account-${status.toLowerCase()}`}>{accountStatusLabel(status)}</span>;
}

export function ServiceBadge({ status }: { status: ServiceStatus }) {
  return <span className={`badge badge-service-${status.toLowerCase()}`}>{serviceStatusLabel(status)}</span>;
}
