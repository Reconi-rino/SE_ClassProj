const API_PREFIX = "/api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function apiRequest(path, { method = "GET", token, tenantCode, body, query } = {}) {
  const response = await fetch(`${API_PREFIX}${path}${buildQuery(query)}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantCode ? { "x-tenant-code": tenantCode } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    let message = data?.message;
    if (!message) {
      if (response.status >= 500) {
        message = "服务器暂时不可用，请稍后重试。";
      } else if (response.status === 404) {
        message = "请求的资源不存在。";
      } else if (response.status === 401) {
        message = "登录状态已失效，请重新登录。";
      } else if (response.status === 403) {
        message = "您暂无权限执行该操作。";
      } else {
        message = `请求失败（${response.status}）`;
      }
    }
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.errors || [];
    throw error;
  }

  return data;
}
