import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SimpleApp from "./SimpleApp";
// Temporarily use SimpleApp to isolate issues
// import { Toaster } from "@/components/ui/toaster";
// import App from "./App";
import "./index.css";
import { register } from "./utils/serviceWorkerRegistration";

// Error boundary to catch any rendering issues
class ErrorBoundary extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorBoundary';
  }
}

// Minimal error handling and component loading
function initializeApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found");
    return;
  }

  try {
    createRoot(rootElement).render(
      <StrictMode>
        <SimpleApp />
      </StrictMode>
    );
    
    console.log("App rendered successfully");
    
    // Register service worker after app loads
    setTimeout(() => {
      if ('serviceWorker' in navigator) {
        register({
          onSuccess: (registration) => {
            console.log('SW registered: ', registration);
          },
          onUpdate: (registration) => {
            console.log('SW updated: ', registration);
          },
        });
      }
    }, 1000);
    
  } catch (error) {
    console.error('Failed to render app:', error);
    // Simple error fallback
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: system-ui;">
        <h1 style="color: #1565C0;">UniLoop@IIMR</h1>
        <p style="color: #666; margin: 20px 0;">Loading...</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #1565C0; color: white; border: none; border-radius: 8px;">
          Refresh Page
        </button>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
