import { useAuth } from '@/hooks/useAuth';
import CompactAccountSwitcher from './CompactAccountSwitcher';
import uniloopLogomark from '@assets/uniloop logomark_1753618415583.png';

export default function TopAppBar() {
  const { user } = useAuth();

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
            <img 
              src={uniloopLogomark} 
              alt="UniLoop Logo" 
              className="w-5 h-5 lg:w-6 lg:h-6 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-medium lg:text-large font-medium truncate">UniLoop@IIMR</h1>
            <p className="text-small lg:text-medium opacity-80 capitalize truncate">
              {(user as any)?.role || 'Student'} Portal
            </p>
          </div>
        </div>
        
        {/* Right section: Actions and profile */}
        <div className="flex items-center space-x-2 lg:space-x-3 flex-shrink-0">
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
    </>
  );
}
