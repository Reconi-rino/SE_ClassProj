import { apiRequest } from "./apiClient";

export function fetchTenantContext({ token, tenantCode }) {
  return apiRequest("/business/tenant-context", { token, tenantCode });
}

export function listClubs({ token, tenantCode, search, status }) {
  return apiRequest("/clubs", { token, tenantCode, query: { q: search, status } });
}

export function getClub({ token, tenantCode, id }) {
  return apiRequest(`/clubs/${id}`, { token, tenantCode });
}

export function createClub({ token, tenantCode, payload }) {
  return apiRequest("/clubs", { token, tenantCode, method: "POST", body: payload });
}

export function listClubMembers({ token, tenantCode, clubId }) {
  return apiRequest(`/clubs/${clubId}/members`, { token, tenantCode });
}

export function addClubMember({ token, tenantCode, clubId, payload }) {
  return apiRequest(`/clubs/${clubId}/members/join`, { token, tenantCode, method: "POST", body: payload });
}

export function updateClubMemberRole({ token, tenantCode, clubId, memberId, payload }) {
  return apiRequest(`/clubs/${clubId}/members/${memberId}/role`, { token, tenantCode, method: "PATCH", body: payload });
}

export function removeClubMember({ token, tenantCode, clubId, memberId }) {
  return apiRequest(`/clubs/${clubId}/members/${memberId}`, { token, tenantCode, method: "DELETE" });
}

export function listActivities({ token, tenantCode, status, clubId, startDate, endDate }) {
  return apiRequest("/business/activities", {
    token,
    tenantCode,
    query: { status, clubId, startDate, endDate },
  });
}

export function getActivity({ token, tenantCode, id }) {
  return apiRequest(`/business/activities/${id}`, { token, tenantCode });
}

export function createActivity({ token, tenantCode, payload }) {
  return apiRequest("/business/activities", { token, tenantCode, method: "POST", body: payload });
}

export function updateActivityStatus({ token, tenantCode, id, payload }) {
  return apiRequest(`/business/activities/${id}`, { token, tenantCode, method: "PATCH", body: payload });
}

export function submitActivityApproval({ token, tenantCode, id, payload }) {
  return apiRequest(`/business/activities/${id}/submit-approval`, { token, tenantCode, method: "POST", body: payload });
}

export function listApprovals({ token, tenantCode, status }) {
  return apiRequest("/business/approvals/pending", { token, tenantCode, query: { status } });
}

export function decideApproval({ token, tenantCode, id, payload }) {
  return apiRequest(`/business/approvals/${id}/decision`, { token, tenantCode, method: "POST", body: payload });
}

export function listFinancialRecords({ token, tenantCode, clubId, type, month }) {
  return apiRequest("/financial-records", {
    token,
    tenantCode,
    query: { clubId, type, month },
  });
}

export function createFinancialRecord({ token, tenantCode, payload }) {
  return apiRequest("/financial-records", { token, tenantCode, method: "POST", body: payload });
}

export function getFinancialReports({ token, tenantCode, year }) {
  return apiRequest("/financial-records/reports/yearly", { token, tenantCode, query: { year } });
}

export function getFinancialPublicRecords({ tenantCode, month }) {
  return apiRequest("/financial-records/reports/monthly", { tenantCode, query: { month } });
}
