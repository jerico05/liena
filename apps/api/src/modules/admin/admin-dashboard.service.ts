import { getAdminDashboard as getDashboard } from "./admin-provider.service";

export async function getAdminDashboard() {
  return getDashboard();
}
