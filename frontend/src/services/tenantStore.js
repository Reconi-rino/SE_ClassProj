const TENANT_CODE_KEY = "ccms_tenant_code";

export function getTenantCode() {
  return localStorage.getItem(TENANT_CODE_KEY) || "";
}

export function setTenantCode(value) {
  if (!value) {
    localStorage.removeItem(TENANT_CODE_KEY);
    return;
  }
  localStorage.setItem(TENANT_CODE_KEY, value.trim());
}
