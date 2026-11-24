import { apiRequest } from "./apiClient";

export function listReimbursements({ token, tenantCode, scope, status, signal }) {
  return apiRequest("/reimbursements", { token, tenantCode, signal, query: { scope, status } });
}

export function saveReimbursement({ token, tenantCode, id, action, body }) {
  const path = id ? `/reimbursements/${id}/${action}` : "/reimbursements";
  return apiRequest(path, { token, tenantCode, method: "POST", body });
}
