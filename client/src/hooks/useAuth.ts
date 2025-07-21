import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export function useAuth() {
  // Session-based authentication using Auth0 Google OAuth
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
