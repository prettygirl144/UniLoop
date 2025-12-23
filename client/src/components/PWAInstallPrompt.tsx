import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Smartphone, Share, Plus } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function PWAInstallPrompt() {
  const { isInstallable, installApp, dismissPrompt, canInstall } = usePWAInstall();
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone;
    const isInAppBrowser = !isStandalone && window.matchMedia('(display-mode: browser)').matches;

    if (isIOS && !isStandalone && isInAppBrowser) {
      // Show iOS-specific install banner after a short delay
      const timer = setTimeout(() => {
        setShowIOSBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (canInstall) {
      setShowPrompt(true);
    }
  }, [canInstall]);

  const handleInstall = async () => {
    await installApp();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    dismissPrompt();
    setShowPrompt(false);
    setShowIOSBanner(false);
  };

  // iOS Safari install banner
  if (showIOSBanner) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-primary text-white p-4 z-50 shadow-lg">
        <div className="flex items-start justify-between max-w-sm mx-auto">
          <div className="flex items-start space-x-3 flex-1">
            <Smartphone size={20} className="mt-1 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">Install UniLoop@IIMR</div>
              <div className="text-xs opacity-90 flex items-center">
                Tap <Share size={12} className="mx-1" /> Share → 
                <Plus size={12} className="mx-1" /> Add to Home Screen
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-10 p-1 flex-shrink-0 ml-2"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    );
  }

  // Standard beforeinstallprompt banner
  if (!showPrompt || !isInstallable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-primary text-white p-4 z-50 shadow-lg">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center space-x-3">
          <Smartphone size={20} />
          <span className="text-sm font-medium">Install UniLoop@IIMR</span>
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
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-10 p-1"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
