import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { register } from "./utils/serviceWorkerRegistration";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA functionality with better update handling
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
