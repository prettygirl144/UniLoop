import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

export default function Auth0Logout() {
  const { logout } = useAuth0();

  useEffect(() => {
    logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }, [logout]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <LogOut className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Signing Out</CardTitle>
          <CardDescription>
            Please wait while we securely sign you out...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            You will be redirected shortly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}