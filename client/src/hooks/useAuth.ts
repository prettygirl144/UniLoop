import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string;
  permissions: {
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
    triathlon?: boolean;
    sickFoodAccess?: boolean;
    leaveApplicationAccess?: boolean;
    grievanceAccess?: boolean;
    menuUpload?: boolean;
  };
  batch?: string;
  section?: string;
  createdAt: string;
  updatedAt: string;
}

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
