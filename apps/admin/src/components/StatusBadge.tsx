import { providerStatusLabel } from "../lib/format";
import type { ProviderStatus } from "../lib/types";

export function StatusBadge({ status }: { status: ProviderStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{providerStatusLabel(status)}</span>;
}
