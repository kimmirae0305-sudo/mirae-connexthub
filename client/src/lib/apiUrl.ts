export function resolveApiUrl(url: string): string {
  if (!url.startsWith("/api")) {
    return url;
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL;
  if (!apiBaseUrl) {
    return url;
  }

  return `${apiBaseUrl.replace(/\/$/, "")}${url}`;
}
