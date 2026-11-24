import { apiRequest } from "./apiClient";

export function listOpenActivities({ tenantCode, clubId, signal }) {
  return apiRequest("/public/activities", { tenantCode, query: { club_id: clubId }, signal });
}

export function listMyRegistrations({ token, tenantCode, signal }) {
  return apiRequest("/business/my-registrations", { token, tenantCode, signal });
}

export function changeRegistration({ id, token, tenantCode, cancel }) {
  return apiRequest(`/business/activities/${id}/registration`, {
    token,
    tenantCode,
    method: cancel ? "DELETE" : "PUT",
  });
}

export function listRegistrationRoster({ id, token, tenantCode, signal }) {
  return apiRequest(`/business/activities/${id}/registrations`, { token, tenantCode, signal });
}

export function cancelPublishedActivity({ id, token, tenantCode, reason }) {
  return apiRequest(`/business/activities/${id}/cancel`, {
    method: "POST", token, tenantCode, body: { reason },
  });
}

export function setRegistrationAttendance({ id, userId, token, tenantCode, checkedIn }) {
  return apiRequest(`/business/activities/${id}/registrations/${userId}/attendance`, {
    method: "PUT", token, tenantCode, body: { checked_in: checkedIn },
  });
}

export function markCancellationRead({ id, token, tenantCode }) {
  return apiRequest(`/business/activities/${id}/registration/cancellation-read`, {
    method: "PATCH", token, tenantCode,
  });
}
