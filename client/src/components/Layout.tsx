import { ReactNode } from 'react';
import TopAppBar from './TopAppBar';
import BottomNavigation from './BottomNavigation';
import PWAInstallPrompt from './PWAInstallPrompt';
import InstallFAB from './InstallFAB';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-h-screen bg-surface relative
                    /* Mobile-first: full width with padding */
                    px-4 sm:px-6 md:px-8 lg:px-12
                    /* Desktop: centered layout with max width */
                    lg:max-w-7xl lg:mx-auto
                    /* Mobile optimization: prevent horizontal scroll */
                    overflow-x-hidden">
      <PWAInstallPrompt />
      <TopAppBar />
      
      {/* Main content area with responsive padding */}
      <div className="pt-16 pb-20 
                      /* Mobile: minimal spacing */
                      min-h-screen
                      /* Desktop: more generous spacing */
                      lg:pt-20 lg:pb-8">
        <div className="w-full 
                       /* Mobile: full width */
                       max-w-full
                       /* Desktop: responsive max width */
                       lg:max-w-6xl lg:mx-auto">
          {children}
        </div>
      </div>

      <BottomNavigation />
      <InstallFAB />
      
      {/* Responsive Offline Indicator */}
      <div id="offline-indicator" className="hidden fixed top-16 left-4 right-4 bg-error text-white p-3 rounded-lg shadow-lg z-40
                                           /* Mobile: full width minus padding */
                                           mx-4
                                           /* Desktop: centered with max width */
                                           lg:max-w-md lg:mx-auto lg:left-auto lg:right-auto">
        <div className="flex items-center space-x-2">
          <i className="fas fa-wifi-slash"></i>
          <span className="text-small">You're offline. Some features may be limited.</span>
        </div>
      </div>
    </div>
  );
}
