import axios from "axios";

export function fieldErrors(error: unknown): Record<string, string> {
  const detail: unknown = axios.isAxiosError(error) ? error.response?.data?.detail : null;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return {};
  return Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, String(value)]));
}

export function errorMessage(error: unknown, fallback: string): string {
  const detail: unknown = axios.isAxiosError(error) ? error.response?.data?.detail : null;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return "Please check the highlighted fields.";
  return fallback;
}
