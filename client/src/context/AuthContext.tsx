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
  
  // Add error handling for query
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fallback mechanism if query fails completely
  useEffect(() => {
    const timer = setTimeout(() => {
      setFallbackLoading(false);
    }, 3000); // 3 second timeout
    
    return () => clearTimeout(timer);
  }, []);

  const contextValue = {
    user: user as User | null,
    isLoading: isLoading && fallbackLoading,
    isAuthenticated: !!user
  };

  // If there's a critical error, provide fallback context
  if (error && !fallbackLoading) {
    console.warn('Auth query failed, using fallback:', error);
    return (
      <AuthContext.Provider value={{
        user: null,
        isLoading: false,
        isAuthenticated: false
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

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
