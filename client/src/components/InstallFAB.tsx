import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function InstallFAB() {
  const { isInstallable, installApp, isInstalled } = usePWAInstall();

  // Don't show if already installed or not installable
  if (!isInstallable || isInstalled) return null;

  return (
    <Button
      onClick={installApp}
      size="sm"
      className="fixed bottom-20 right-4 z-40 rounded-full w-12 h-12 p-0 shadow-lg
                 bg-primary hover:bg-primary/90 text-white
                 transition-all duration-300 ease-in-out
                 animate-pulse-soft"
      aria-label="Install UniLoop@IIMR app"
      title="Install UniLoop@IIMR"
    >
      <Download size={20} />
    </Button>
  );
}