import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import type { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Session-based authentication using Auth0 Google OAuth
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Heartbeat to keep sessions alive and push subscription management
  useEffect(() => {
    const heartbeat = async () => {
      try {
        await fetch('/api/auth/heartbeat', {
          method: 'GET',
          credentials: 'include', // Include cookies
        });
      } catch (error) {
        console.log('Heartbeat failed:', error);
      }
    };

    // Call heartbeat on mount
    heartbeat();

    // Call heartbeat when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        heartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic heartbeat every 30 minutes (reduced from 5 min to save compute costs)
    const interval = setInterval(heartbeat, 30 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [user]); // Depend on user to re-run when authentication changes

  return (
    <AuthContext.Provider value={{ 
      user: user as User | null, 
      isLoading, 
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
