import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";

export function PWAStatus({ reload }: { reload: (() => void) | null }) {
  const online = useOnline();
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (online) {
      const t = setTimeout(() => setShowOffline(false), 1500);
      return () => clearTimeout(t);
    }
    setShowOffline(true);
  }, [online]);

  return (
    <>
      {showOffline && !online && (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow">
          <WifiOff className="h-3.5 w-3.5" />
          Offline Mode - Sales are being stored safely on this device.
        </div>
      )}

      {reload && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm">A new version is available.</span>
          <Button size="sm" onClick={reload}>Update</Button>
        </div>
      )}
    </>
  );
}
