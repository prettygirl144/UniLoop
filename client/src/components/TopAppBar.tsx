import { useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import CompactAccountSwitcher from './CompactAccountSwitcher';

export default function TopAppBar() {
  const { user } = useAuthContext();
  const [showNotifications, setShowNotifications] = useState(false);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <>
      <div className="bg-primary text-white p-4 flex items-center justify-between relative">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <i className="fas fa-graduation-cap text-sm"></i>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Campus Connect</h1>
            <p className="text-xs opacity-80 capitalize">{user?.role || 'Student'} Portal</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleNotifications}
            className="relative text-white hover:bg-white hover:bg-opacity-10 p-2"
          >
            <Bell size={18} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>
          </Button>
          
          {/* Account Switcher */}
          <div style={{ zIndex: 50 }}>
            <CompactAccountSwitcher />
          </div>
          
          {user?.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover border-2 border-white border-opacity-30"
            />
          ) : (
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.firstName?.charAt(0) || 'U'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="fixed top-16 left-4 right-4 bg-surface rounded-xl shadow-xl border border-gray-200 z-40 max-w-sm mx-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Notifications</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleNotifications}
                className="text-text-secondary h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-primary bg-opacity-5 rounded-lg border-l-4 border-primary">
                <p className="text-sm font-medium">Welcome to Campus Connect!</p>
                <p className="text-xs text-text-secondary">Get started by exploring the features</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
