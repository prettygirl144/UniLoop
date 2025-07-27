import { useLocation, Link } from 'wouter';
import { Home, Calendar, MessageSquare, Utensils, Users, Settings, Image } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/', icon: Home, label: 'Home', id: 'dashboard' },
  { path: '/calendar', icon: Calendar, label: 'Events', id: 'calendar' },
  { path: '/gallery', icon: Image, label: 'Gallery', id: 'gallery' },
  { path: '/forum', icon: MessageSquare, label: 'Forum', id: 'forum' },
  { path: '/amenities', icon: Utensils, label: 'Amenities', id: 'amenities' },
];

const adminNavItem = { path: '/admin', icon: Settings, label: 'Admin', id: 'admin' };

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Add admin item for admin users
  const allNavItems = (user as any)?.role === 'admin' ? [...navItems, adminNavItem] : navItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 z-40
                    /* Mobile: full width with safe area */
                    pb-safe
                    /* Desktop: centered with max width */
                    lg:left-1/2 lg:transform lg:-translate-x-1/2 lg:max-w-6xl lg:rounded-t-xl lg:shadow-lg">
      <div className="flex items-center justify-around 
                      /* Mobile: compact padding for thumb reach */
                      py-2 px-2
                      /* Desktop: more spacious */
                      lg:py-3 lg:px-4">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <button 
                className={`flex flex-col items-center 
                           /* Mobile: optimized tap target and spacing */
                           py-2 px-3 min-w-[52px] min-h-[48px]
                           /* Desktop: larger targets */
                           lg:py-3 lg:px-4 lg:min-w-[60px]
                           /* Touch feedback */
                           active:scale-95 transition-all duration-150
                           /* Focus ring for accessibility */
                           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-30
                           /* Color states */
                           ${isActive 
                             ? 'text-primary bg-primary bg-opacity-10 rounded-lg' 
                             : 'text-text-secondary hover:text-primary hover:bg-gray-50'
                           }
                           /* Mobile: rounded corners for modern feel */
                           rounded-lg`}
                aria-label={item.label}
              >
                <Icon size={20} className="mb-1 lg:mb-2 flex-shrink-0" />
                <span className="text-small font-medium truncate max-w-full">
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
      
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-bottom bg-surface lg:hidden" />
    </div>
  );
}
