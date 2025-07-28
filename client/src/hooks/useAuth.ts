import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Session-based authentication using Auth0 Google OAuth
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
