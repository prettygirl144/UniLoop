import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";
import { register } from "./utils/serviceWorkerRegistration";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);

// Register service worker for PWA functionality
register({
  onSuccess: (registration) => {
    console.log('SW registered: ', registration);
  },
  onUpdate: (registration) => {
    console.log('SW updated: ', registration);
  },
});
