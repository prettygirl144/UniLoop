import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from './useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

export function useAuth0Integration() {
  const auth0 = useAuth0();
  const existingAuth = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if Auth0 is configured
  const isAuth0Configured = import.meta.env.VITE_AUTH0_DOMAIN && 
                            import.meta.env.VITE_AUTH0_CLIENT_ID && 
                            import.meta.env.VITE_AUTH0_AUDIENCE;

  // Auth0 user sync mutation
  const syncUserMutation = useMutation({
    mutationFn: async (auth0User: any) => {
      const token = await auth0.getAccessTokenSilently();
      return await apiRequest('/api/auth0/sync-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth0Id: auth0User.sub,
          email: auth0User.email,
          name: auth0User.name,
          picture: auth0User.picture,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      console.error('Error syncing Auth0 user:', error);
      toast({
        title: "Error",
        description: "Failed to sync user profile",
        variant: "destructive",
      });
    },
  });

  // Enhanced login function
  const login = async () => {
    if (isAuth0Configured) {
      return auth0.loginWithRedirect({
        authorizationParams: {
          connection: 'google-oauth2',
        }
      });
    } else {
      // Fallback to existing authentication
      window.location.href = '/api/login';
    }
  };

  // Enhanced logout function  
  const logout = async () => {
    if (isAuth0Configured) {
      return auth0.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });
    } else {
      // Fallback to existing logout
      window.location.href = '/api/logout';
    }
  };

  // Get access token for API calls
  const getAccessToken = async () => {
    if (isAuth0Configured && auth0.isAuthenticated) {
      return await auth0.getAccessTokenSilently();
    }
    return null; // Existing auth uses cookies/session
  };

  // Unified user object
  const getUser = () => {
    if (isAuth0Configured && auth0.isAuthenticated && auth0.user) {
      return {
        id: auth0.user.sub,
        email: auth0.user.email,
        name: auth0.user.name,
        picture: auth0.user.picture,
        role: auth0.user['https://campusconnect.app/roles']?.[0] || 'student',
        permissions: auth0.user['https://campusconnect.app/permissions'] || {},
      };
    }
    return existingAuth.user;
  };

  // Unified loading state
  const isLoading = isAuth0Configured ? auth0.isLoading : existingAuth.isLoading;

  // Unified authentication state
  const isAuthenticated = isAuth0Configured ? auth0.isAuthenticated : existingAuth.isAuthenticated;

  return {
    // Unified interface
    user: getUser(),
    isLoading,
    isAuthenticated,
    login,
    logout,
    getAccessToken,
    
    // Auth0-specific
    isAuth0Configured,
    auth0User: auth0.user,
    syncUserMutation,
    
    // Existing auth fallback
    existingUser: existingAuth.user,
  };
}