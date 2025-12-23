import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Global variable to store the getAccessToken function from Auth0
let globalGetAccessToken: (() => Promise<string>) | null = null;

export function setGlobalAccessTokenFunction(getAccessToken: () => Promise<string>) {
  globalGetAccessToken = getAccessToken;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [API-REQUEST] Starting ${method} request - URL: ${url}, RequestID: ${requestId}`);
  
  if (data) {
    console.log(`📝 [API-REQUEST] Request data (RequestID: ${requestId}):`, data);
  }

  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};

  // Add Auth0 JWT token if available
  if (globalGetAccessToken) {
    try {
      const token = await globalGetAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get access token:', error);
    }
  }

  // Add request ID to headers for server tracking
  headers['X-Request-ID'] = requestId;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`📊 [API-REQUEST] Response received - Status: ${res.status}, RequestID: ${requestId}`);
    
    await throwIfResNotOk(res);
    
    console.log(`✅ [API-REQUEST] Request successful - RequestID: ${requestId}`);
    return res;
  } catch (error) {
    console.error(`❌ [API-REQUEST] Request failed - RequestID: ${requestId}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: HeadersInit = {};

    // Add Auth0 JWT token if available
    if (globalGetAccessToken) {
      try {
        const token = await globalGetAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get access token for query:', error);
      }
    }

    // Construct URL with proper query parameter handling
    let url: string;
    const [baseUrl, ...params] = queryKey as [string, ...any[]];
    
    if (baseUrl === '/api/batch-sections' && params.length > 0 && Array.isArray(params[0])) {
      // Special handling for batch-sections endpoint
      const batches = params[0] as string[];
      const encodedBatches = batches.map(batch => encodeURIComponent(batch)).join(',');
      url = `${baseUrl}?batches=${encodedBatches}`;
    } else {
      // Default behavior for other endpoints
      url = queryKey.join("/") as string;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
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
