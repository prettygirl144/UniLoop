import { ReactNode } from 'react';
import TopAppBar from './TopAppBar';
import BottomNavigation from './BottomNavigation';
import PWAInstallPrompt from './PWAInstallPrompt';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="max-w-sm mx-auto bg-surface min-h-screen shadow-2xl relative">
      <PWAInstallPrompt />
      <TopAppBar />
      
      <div className="pb-20">
        {children}
      </div>

      <BottomNavigation />
      
      {/* Offline Indicator */}
      <div id="offline-indicator" className="hidden fixed top-16 left-4 right-4 bg-error text-white p-3 rounded-lg shadow-lg z-40 max-w-sm mx-auto">
        <div className="flex items-center space-x-2">
          <i className="fas fa-wifi-slash"></i>
          <span className="text-sm">You're offline. Some features may be limited.</span>
        </div>
      </div>
    </div>
  );
}
