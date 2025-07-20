import { useLocation, Link } from 'wouter';
import { Home, Calendar, MessageSquare, Utensils, Users, Settings, Image } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/', icon: Home, label: 'Home', id: 'dashboard' },
  { path: '/calendar', icon: Calendar, label: 'Events', id: 'calendar' },
  { path: '/gallery', icon: Image, label: 'Gallery', id: 'gallery' },
  { path: '/forum', icon: MessageSquare, label: 'Forum', id: 'forum' },
  { path: '/dining', icon: Utensils, label: 'Dining', id: 'dining' },
];

const adminNavItem = { path: '/admin', icon: Settings, label: 'Admin', id: 'admin' };

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Add admin item for admin users
  const allNavItems = user?.role === 'admin' ? [...navItems, adminNavItem] : navItems;

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-surface border-t border-gray-200">
      <div className="flex items-center justify-around py-2">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <button 
                className={`flex flex-col items-center py-2 px-3 ${
                  isActive ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                <Icon size={20} className="mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
