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

// Admin-specific hook: admin role OR manageStudents RBAC can access Admin page
export function useIsAdmin() {
  const { user, isLoading } = useAuth();
  
  const isAdmin = !!user && (user.role === 'admin' || !!user.permissions?.manageStudents);
  
  return { 
    isAdmin, 
    isLoading 
  };
}
