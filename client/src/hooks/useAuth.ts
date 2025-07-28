import { useAuthContext } from "@/context/AuthContext";

export function useAuth() {
  // Use the AuthContext instead of direct React Query
  return useAuthContext();
}
