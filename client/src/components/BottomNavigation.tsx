import { useLocation, Link } from 'wouter';
import { Home, Calendar, MessageSquare, Utensils, Users } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home', id: 'dashboard' },
  { path: '/calendar', icon: Calendar, label: 'Events', id: 'calendar' },
  { path: '/forum', icon: MessageSquare, label: 'Forum', id: 'forum' },
  { path: '/dining', icon: Utensils, label: 'Dining', id: 'dining' },
  { path: '/directory', icon: Users, label: 'Directory', id: 'directory' },
];

export default function BottomNavigation() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-surface border-t border-gray-200">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
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
