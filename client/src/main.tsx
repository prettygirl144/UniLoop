import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { register } from "./utils/serviceWorkerRegistration";

// Verification marker - unique timestamp to confirm code is running
console.log(`🚀 Client App Started - Version 1.0.3-TRIAGE - ${new Date().toISOString()}`);
console.log(`📍 Environment: ${import.meta.env.MODE}`);
console.log(`🌐 Base URL: ${window.location.origin}`);
console.log(`🍽️ Sick Food Diagnostics: TRIAGE MODE - Full visibility active`);
console.log(`📦 Service Worker: ${navigator.serviceWorker ? 'Supported' : 'Not Supported'}`);
console.log(`🔍 API_BASE_URL Resolution: ${window.location.origin} (same origin)`);
console.log(`🔄 Query Key Debugging: Active`);

// Step 1: Enforce single mount and render
const root = createRoot(document.getElementById('root')!);
const app = <App />;
root.render(import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app);

// Step 7: Prevent double service-worker registration
if (!(window as any).__SW_REGISTERED__) {
  (window as any).__SW_REGISTERED__ = true;
  register({
    onSuccess: (registration) => {
      console.log('SW registered: ', registration);
    },
    onUpdate: (registration) => {
      console.log('SW updated: ', registration);
      // In development, the service worker registration already handles the reload
      // In production, you might want to show a notification to the user
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname.includes('replit.dev') ||
                           window.location.hostname.includes('replit.app');
      
      if (!isDevelopment) {
        // For production, you could show a toast or notification
        console.log('New app version available! Please refresh to update.');
      }
    },
  });
}
