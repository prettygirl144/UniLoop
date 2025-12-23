import { useAuth0 } from "@auth0/auth0-react";

// Enhanced API client that supports Auth0 JWT tokens
export async function apiRequestWithAuth(
  url: string, 
  options: RequestInit = {},
  getAccessToken?: () => Promise<string>
) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Auth0 JWT token if available
  if (getAccessToken) {
    try {
      const token = await getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get access token:', error);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status}: ${message}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }
  
  return await response.text();
}

// Hook to get the authenticated API client
export function useApiClient() {
  const auth0 = useAuth0();
  
  const isAuth0Configured = !!(import.meta.env.VITE_AUTH0_DOMAIN && 
                               import.meta.env.VITE_AUTH0_CLIENT_ID && 
                               import.meta.env.VITE_AUTH0_AUDIENCE);

  return {
    apiRequest: async (url: string, options: RequestInit = {}) => {
      const getAccessToken = isAuth0Configured && auth0.isAuthenticated 
        ? auth0.getAccessTokenSilently 
        : undefined;
      
      return apiRequestWithAuth(url, options, getAccessToken);
    }
  };
}