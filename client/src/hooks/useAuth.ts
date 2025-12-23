import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  // Session-based authentication using Auth0 Google OAuth
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

// Admin-specific hook following the guidance requirements
export function useIsAdmin() {
  const { user, isLoading } = useAuth();
  
  // Derive isAdmin flag once as specified in requirements
  const isAdmin = !!user && user.role === 'admin';
  
  return { 
    isAdmin, 
    isLoading 
  };
}
