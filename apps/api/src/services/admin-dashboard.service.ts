import { config } from "../config/env";
import { withAdminMockMeta } from "../utils/admin-api-meta";
import { getDashboardData } from "../repositories/admin-provider.repository";
import { getMockDashboard } from "./admin-provider.mock-store";

export async function getAdminDashboard() {
  if (config.ADMIN_MOCK_DATA) {
    return withAdminMockMeta({ data: getMockDashboard() });
  }
  return { data: await getDashboardData() };
}
