import { useIsAdmin } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface AdminGuardProps {
  children: React.ReactNode;
}

function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, isLoading } = useIsAdmin();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Admin access required. You don't have permission to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default AdminGuard;