/** Pull the server's message out of an axios error so the UI can show it. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string; detail?: string; error?: string } } })?.response?.data;
  return data?.message || data?.detail || data?.error || fallback;
}
