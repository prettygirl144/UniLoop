import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Smartphone } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-primary text-white p-4 z-50 shadow-lg">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center space-x-3">
          <Smartphone size={20} />
          <span className="text-sm font-medium">Install Campus Connect</span>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleInstall}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-xs px-3 py-1"
          >
            Install
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissPrompt}
            className="text-white hover:bg-white hover:bg-opacity-10 p-1"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
