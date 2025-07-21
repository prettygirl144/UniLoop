import { ReactNode } from 'react';
import TopAppBar from './TopAppBar';
import BottomNavigation from './BottomNavigation';
import PWAInstallPrompt from './PWAInstallPrompt';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="container-mobile min-h-screen bg-background relative">
      <PWAInstallPrompt />
      <TopAppBar />
      
      <main className="page-container">
        {children}
      </main>

      <BottomNavigation />
      
      {/* Offline Indicator */}
      <div id="offline-indicator" className="hidden fixed top-16 left-4 right-4 bg-destructive text-destructive-foreground p-md rounded-lg shadow-lg z-40 container-mobile">
        <div className="flex items-center gap-sm">
          <span className="text-lg">📶</span>
          <span className="text-body">You're offline. Some features may be limited.</span>
        </div>
      </div>
    </div>
  );
}
