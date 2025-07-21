import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { setGlobalAccessTokenFunction } from "@/lib/queryClient";

export function useAuth() {
  const auth0 = useAuth0();
  
  // Check if Auth0 is configured (simplified - no audience needed)
  const isAuth0Configured = !!(import.meta.env.VITE_AUTH0_DOMAIN && 
                               import.meta.env.VITE_AUTH0_CLIENT_ID);

  // Set up global access token function for API requests
  useEffect(() => {
    if (isAuth0Configured && auth0.isAuthenticated) {
      setGlobalAccessTokenFunction(auth0.getAccessTokenSilently);
    }
  }, [isAuth0Configured, auth0.isAuthenticated, auth0.getAccessTokenSilently]);

  // Use Auth0 authentication if configured
  if (isAuth0Configured) {
    const { data: dbUser } = useQuery({
      queryKey: ["/api/auth/user"],
      retry: false,
      enabled: auth0.isAuthenticated,
    });

    return {
      user: dbUser || (auth0.user ? {
        id: auth0.user.sub,
        email: auth0.user.email,
        firstName: auth0.user.name?.split(' ')[0] || '',
        lastName: auth0.user.name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: auth0.user.picture,
        role: auth0.user['https://campusconnect.app/roles']?.[0] || 'student',
        permissions: auth0.user['https://campusconnect.app/permissions'] || {},
      } : null),
      isLoading: auth0.isLoading,
      isAuthenticated: auth0.isAuthenticated,
      getAccessToken: auth0.getAccessTokenSilently,
    };
  }

  // Fallback to existing authentication
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    getAccessToken: null,
  };
}
