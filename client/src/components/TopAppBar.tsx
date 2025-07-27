import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import CompactAccountSwitcher from './CompactAccountSwitcher';

export default function TopAppBar() {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <>
      {/* Mobile-first responsive top app bar with fixed position */}
      <div className="fixed top-0 left-0 right-0 bg-primary text-white z-50
                      /* Mobile: compact padding and layout */
                      px-4 py-3 
                      /* Desktop: more spacious */
                      lg:px-6 lg:py-4
                      /* Responsive layout */
                      flex items-center justify-between
                      /* Mobile optimization: prevent text selection on touch */
                      select-none
                      /* Box shadow for mobile depth */
                      shadow-lg lg:shadow-md">
        
        {/* Left section: Logo and title */}
        <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-1">
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0
                          /* Mobile: touch-optimized */
                          active:bg-opacity-30 transition-colors duration-150">
            <i className="fas fa-graduation-cap text-small lg:text-medium"></i>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-medium lg:text-large font-medium truncate">UniLoop</h1>
            <p className="text-small lg:text-medium opacity-80 capitalize truncate">
              {(user as any)?.role || 'Student'} Portal
            </p>
          </div>
        </div>
        
        {/* Right section: Actions and profile */}
        <div className="flex items-center space-x-2 lg:space-x-3 flex-shrink-0">
          {/* Mobile-optimized notification button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleNotifications}
            className="relative text-white hover:bg-white hover:bg-opacity-10 
                       /* Mobile: larger tap target */
                       h-10 w-10 p-2
                       /* Desktop: standard size */
                       lg:h-9 lg:w-9
                       /* Touch feedback */
                       active:bg-white active:bg-opacity-20 transition-colors duration-150
                       /* Focus ring for accessibility */
                       focus:ring-2 focus:ring-white focus:ring-opacity-30"
            aria-label="Toggle notifications"
          >
            <Bell size={18} className="lg:w-5 lg:h-5" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>
          </Button>
          
          {/* Account Switcher with responsive positioning */}
          <div className="relative z-50">
            <CompactAccountSwitcher />
          </div>
          
          {/* Profile image with touch optimization */}
          {(user as any)?.profileImageUrl ? (
            <img 
              src={(user as any).profileImageUrl} 
              alt="Profile" 
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover border-2 border-white border-opacity-30
                         /* Touch feedback */
                         active:scale-95 transition-transform duration-150"
            />
          ) : (
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center
                            /* Touch feedback */
                            active:scale-95 transition-transform duration-150">
              <span className="text-small lg:text-medium font-medium">
                {(user as any)?.firstName?.charAt(0) || 'U'}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Mobile-optimized notification panel */}
      {showNotifications && (
        <>
          {/* Mobile: overlay backdrop for touch dismissal */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 z-40 lg:hidden"
            onClick={toggleNotifications}
            aria-hidden="true"
          />
          
          <div className="fixed 
                          /* Mobile: full width dropdown */
                          top-16 left-4 right-4 
                          /* Desktop: positioned dropdown */
                          lg:top-20 lg:left-auto lg:right-6 lg:w-80
                          /* Styling */
                          bg-surface rounded-xl shadow-xl border border-gray-200 z-50
                          /* Mobile optimization */
                          max-h-[70vh] overflow-y-auto">
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-medium font-medium">Notifications</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleNotifications}
                  className="text-text-secondary 
                             /* Mobile: larger tap target */
                             h-8 w-8 p-0
                             /* Touch feedback */
                             active:bg-gray-100 transition-colors duration-150
                             /* Focus ring */
                             focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                  aria-label="Close notifications"
                >
                  ×
                </Button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-primary bg-opacity-5 rounded-lg border-l-4 border-primary lg:p-4">
                  <p className="text-small font-medium">Welcome to Campus Connect!</p>
                  <p className="text-small text-text-secondary mt-1">Get started by exploring the features</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400 lg:p-4">
                  <p className="text-small font-medium text-blue-800">New announcement posted</p>
                  <p className="text-small text-blue-600 mt-1">Check the Community tab for updates</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
