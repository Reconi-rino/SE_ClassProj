import { apiRequest } from "./apiClient";

export function fetchPublicTenants() {
  return apiRequest("/tenants", { method: "GET" });
}
