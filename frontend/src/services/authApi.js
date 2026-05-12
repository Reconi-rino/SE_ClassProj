const API_PREFIX = "/api/auth";

async function request(path, options = {}) {
  const { headers: customHeaders = {}, ...restOptions } = options;
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    let message = data?.message;
    if (!message) {
      if (response.status >= 500) {
        message = "认证服务暂时不可用，请稍后重试。";
      } else if (response.status === 401) {
        message = "邮箱或密码错误，请重新输入。";
      } else if (response.status === 403) {
        message = "当前账号无权限执行该操作。";
      } else {
        message = `请求失败（${response.status}）`;
      }
    }
    const error = new Error(message);
    error.details = data?.errors || [];
    throw error;
  }

  return data;
}

export function register(payload) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMe(token) {
  return request("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function resetPassword(token, payload) {
  return request("/reset-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
