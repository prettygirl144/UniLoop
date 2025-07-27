import { useLocation, Link } from 'wouter';
import { Home, Calendar, MessageSquare, Utensils, Users, Settings, Image, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/', icon: Home, label: 'Home', id: 'dashboard' },
  { path: '/calendar', icon: Calendar, label: 'Events', id: 'calendar' },
  { path: '/gallery', icon: Image, label: 'Gallery', id: 'gallery' },
  { path: '/triathlon', icon: Trophy, label: 'Triathlon', id: 'triathlon' },
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
      <div className="flex items-center justify-between 
                      /* Mobile: compact padding, distribute space evenly */
                      py-2 px-1
                      /* Desktop: more spacious */
                      lg:py-3 lg:px-4 lg:justify-around">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            
          );
        })}
      </div>
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-bottom bg-surface lg:hidden" />
    </div>
  );
}
