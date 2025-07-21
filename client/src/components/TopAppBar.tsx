import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Bell, Sun, Moon, Monitor, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CompactAccountSwitcher from './CompactAccountSwitcher';

export default function TopAppBar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <>
      <header className="bg-primary text-primary-foreground border-b border-border/20 sticky top-0 z-30">
        <div className="container-mobile">
          <div className="flex-between py-3">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex-center">
                <span className="text-lg font-bold">🎓</span>
              </div>
              <div>
                <h1 className="text-heading">Campus Connect</h1>
                <p className="text-sm opacity-80 capitalize">Student Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-sm">
              {/* Theme Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="nav-item text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    {getThemeIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleNotifications}
                className="nav-item relative text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Bell className="h-4 w-4" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              </Button>
              
              {/* Account Switcher */}
              <div className="z-50">
                <CompactAccountSwitcher />
              </div>
              
              {/* User Avatar */}
              {user?.picture ? (
                <img 
                  src={user.picture} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover border-2 border-primary-foreground/30"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-foreground/20 rounded-full flex-center">
                  <span className="text-sm font-medium">
                    {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="overlay" onClick={toggleNotifications}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h3 className="text-heading">Notifications</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleNotifications}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="content-spacing">
              <div className="card-elevated p-4 border-l-4 border-accent">
                <p className="text-body font-medium">Welcome to Campus Connect!</p>
                <p className="text-caption">Get started by exploring the features</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}