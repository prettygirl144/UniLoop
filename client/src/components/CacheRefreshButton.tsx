import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { clearAllCaches, forceUpdate } from '@/utils/serviceWorkerRegistration';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useAuth';

interface CacheRefreshButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export default function CacheRefreshButton({ 
  variant = 'outline', 
  size = 'sm', 
  showText = true,
  className = '' 
}: CacheRefreshButtonProps) {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();

  // Check if we're in development environment
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('replit.dev') ||
                       window.location.hostname.includes('replit.app');

  // Only show to admins in development mode as per requirements
  if (!isDevelopment || !isAdmin) return null;

  const handleClearCache = async () => {
    setIsClearing(true);
    
    try {
      toast({
        title: "Clearing Cache",
        description: "Clearing all cached content and refreshing...",
      });

      // Force service worker update first
      await forceUpdate();
      
      // Clear all caches
      await clearAllCaches();
      
      // The clearAllCaches function will handle the reload
    } catch (error) {
      console.error('Error clearing cache:', error);
      setIsClearing(false);
      
      toast({
        title: "Cache Clear Failed", 
        description: "There was an issue clearing the cache. Try refreshing manually.",
        variant: "destructive",
      });
      
      // Fallback: just reload the page
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClearCache}
      disabled={isClearing}
      className={`${className} ${isClearing ? 'opacity-50' : ''}`}
      title="Clear cache and refresh (Development only)"
      data-testid="button-clear-cache"
    >
      <RefreshCw 
        size={16} 
        className={`${isClearing ? 'animate-spin' : ''} ${showText ? 'mr-2' : ''}`} 
      />
      {showText && (
        <span className="text-xs">
          {isClearing ? 'Clearing...' : 'Refresh Cache'}
        </span>
      )}
    </Button>
  );
}

// Development cache status component - admin only per requirements
export function CacheStatusIndicator() {
  const { isAdmin } = useIsAdmin();
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('replit.dev') ||
                       window.location.hostname.includes('replit.app');

  // Only show to admins in development mode as per requirements
  if (!isDevelopment || !isAdmin) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-lg border border-yellow-300 dark:border-yellow-700 text-xs flex items-center gap-2 shadow-lg">
      <AlertCircle size={14} />
      <span>Development Mode</span>
      <CacheRefreshButton variant="ghost" size="sm" showText={false} className="h-6 w-6 p-0 ml-2" />
    </div>
  );
}