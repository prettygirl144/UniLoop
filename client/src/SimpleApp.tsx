// Simplified app component to isolate the issue
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

function SimpleContent() {
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '400px'
      }}>
        <h1 style={{ 
          color: '#1565C0', 
          marginBottom: '16px',
          fontSize: '28px',
          fontWeight: '600'
        }}>
          UniLoop@IIMR
        </h1>
        <p style={{ 
          color: '#666', 
          marginBottom: '24px',
          fontSize: '16px'
        }}>
          Application loaded successfully!
        </p>
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#1565C0',
          color: 'white',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          React + TypeScript + Vite Working
        </div>
        <p style={{ 
          color: '#999', 
          fontSize: '12px', 
          marginTop: '16px' 
        }}>
          Ready to load full application components
        </p>
      </div>
    </div>
  );
}

export default function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SimpleContent />
    </QueryClientProvider>
  );
}