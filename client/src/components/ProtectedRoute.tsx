import { useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof NonNullable<User['permissions']>;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission, 
  requireAdmin 
}: ProtectedRouteProps) {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuthContext();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (user && requireAdmin && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "Admin access required.",
        variant: "destructive",
      });
      return;
    }

    if (user && requiredPermission && !user.permissions?.[requiredPermission] && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this feature.",
        variant: "destructive",
      });
      return;
    }
  }, [isAuthenticated, isLoading, user, toast, requiredPermission, requireAdmin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return null;
  }

  if (requiredPermission && !user?.permissions?.[requiredPermission] && user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
