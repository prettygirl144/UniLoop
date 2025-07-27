import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Shield } from 'lucide-react';

export default function Auth0Login() {
  const { loginWithRedirect, isLoading } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: 'google-oauth2', // Force Google login only
        prompt: 'login',
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-large">Welcome to UniLoop@IIMR</CardTitle>
          <CardDescription>
            Sign in with your Google account to access the campus management system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Button>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Secure authentication powered by Auth0</p>
            <p className="mt-1">Only Google accounts are supported</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}