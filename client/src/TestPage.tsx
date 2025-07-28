// Simple test component to verify React is working
export default function TestPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#1565C0', marginBottom: '16px' }}>
          UniLoop@IIMR
        </h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Application is loading successfully!
        </p>
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
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
        <p style={{ color: '#999', fontSize: '14px', marginTop: '20px' }}>
          React is working properly. Setting up full application...
        </p>
      </div>
    </div>
  );
}