import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';

interface PushNotificationButtonProps {
  className?: string;
  showText?: boolean;
}

export function PushNotificationButton({ className, showText = true }: PushNotificationButtonProps) {
  const { user } = useAuth();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Don't show button if notifications aren't supported or user isn't authenticated
  if (!isSupported || !user) {
    return null;
  }

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Loading...';
    if (permission === 'denied') return 'Blocked';
    return isSubscribed ? 'Notifications On' : 'Enable Notifications';
  };

  const getButtonVariant = () => {
    if (permission === 'denied') return 'secondary';
    return isSubscribed ? 'default' : 'outline';
  };

  return (
    <Button
      onClick={handleToggle}
      disabled={isLoading || permission === 'denied'}
      variant={getButtonVariant()}
      size="sm"
      className={className}
    >
      {isSubscribed ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2 hidden sm:inline">
          {getButtonText()}
        </span>
      )}
    </Button>
  );
}

export default PushNotificationButton;