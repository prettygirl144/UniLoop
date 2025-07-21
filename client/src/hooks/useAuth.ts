import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { setGlobalAccessTokenFunction } from "@/lib/queryClient";

export function useAuth() {
  // Always check session-based authentication (from Auth0 login)
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
