// Debug component to check what's happening
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

function DebugRouter() {
  const { isAuthenticated, isLoading, user } = useAuthContext();

  console.log("DebugRouter - Auth state:", { isAuthenticated, isLoading, user });

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h1 style={{ color: '#1565C0', marginBottom: '16px' }}>UniLoop@IIMR</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>Checking authentication...</p>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #1565C0',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <style dangerouslySetInnerHTML={{
            __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`
          }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ color: '#1565C0', marginBottom: '16px' }}>UniLoop@IIMR</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>Please login to continue</p>
          <a 
            href="/api/login" 
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#1565C0',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            Login with Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#1565C0', marginBottom: '16px' }}>UniLoop@IIMR</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Welcome back, {user?.firstName || 'User'}!
        </p>
        <div style={{
          padding: '16px',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ color: '#2d7d2d', margin: '0', fontWeight: '500' }}>
            Authentication Working ✓
          </p>
          <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 0' }}>
            Role: {user?.role} | Permissions: {Object.keys(user?.permissions || {}).length}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1565C0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Load Full App
        </button>
      </div>
    </div>
  );
}

export default function DebugApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <DebugRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}