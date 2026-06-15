import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { resolveApiUrl } from "./apiUrl";

function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function isPublicAdvisorReviewPath() {
  return (
    typeof window !== "undefined" &&
    (window.location.pathname === "/public/advisor-project-review" ||
      window.location.pathname.startsWith("/public/advisor-project-review/"))
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      if (isPublicAdvisorReviewPath()) {
        throw new Error("Unauthorized");
      }
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(resolveApiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(resolveApiUrl(queryKey.join("/") as string), {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401) {
      if (isPublicAdvisorReviewPath()) {
        throw new Error("Unauthorized");
      }
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
