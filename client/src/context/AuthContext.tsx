import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import type { User } from '@shared/schema';
import { pushManager } from '@/utils/pushNotifications';

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

    const setupPushNotifications = async () => {
      // Only setup push notifications if user is logged in
      if (!user) return;
      
      try {
        await pushManager.initialize();
        
        // Request permission and subscribe only on user gesture
        // This will be triggered when user interacts with the app
        if (document.visibilityState === 'visible') {
          const permission = await pushManager.requestPermission();
          if (permission === 'granted') {
            await pushManager.subscribe();
          }
        }
      } catch (error) {
        console.log('Push notification setup failed:', error);
      }
    };

    // Call heartbeat on mount
    heartbeat();

    // Setup push notifications when user is authenticated
    setupPushNotifications();

    // Call heartbeat and renew push subscription when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        heartbeat();
        // Renew push subscription to update lastSeenAt
        if (user) {
          pushManager.renewSubscription();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Optional: Set up periodic heartbeat every 5 minutes for very active users
    const interval = setInterval(heartbeat, 5 * 60 * 1000);

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
