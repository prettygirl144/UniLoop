import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import type { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fallbackLoading, setFallbackLoading] = useState(true);
  
  // Add error handling for query with proper 401 handling
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });
      
      // If 401, return null to indicate unauthenticated
      if (response.status === 401) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }
  });

  // Fallback mechanism if query fails completely
  useEffect(() => {
    const timer = setTimeout(() => {
      setFallbackLoading(false);
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, []);

  // Stop loading when we have a result (user or null) or when query completes
  const actualLoading = isLoading && fallbackLoading && !error;

  const contextValue = {
    user: user as User | null,
    isLoading: actualLoading,
    isAuthenticated: !!user
  };

  console.log('AuthContext state:', {
    user: !!user,
    isLoading: actualLoading,
    isAuthenticated: !!user,
    error: !!error
  });

  return (
    <AuthContext.Provider value={contextValue}>
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
