const GENERIC_ERROR = "操作失败，请稍后重试。";

export function getUserFacingError(error, fallbackMessage = GENERIC_ERROR) {
  if (!error) {
    return fallbackMessage;
  }

  const detailMessage = Array.isArray(error.details)
    ? error.details.map((item) => item?.msg).filter(Boolean).join("；")
    : "";

  if (detailMessage) {
    return detailMessage;
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
