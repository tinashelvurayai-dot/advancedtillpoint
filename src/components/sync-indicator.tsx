import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudUpload, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOnline } from "@/hooks/use-online";
import { subscribeSync, runSync, type SyncState } from "@/lib/sync-manager";

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>({ pending: 0, syncing: false, lastSync: null });
  useEffect(() => subscribeSync(setState), []);
  return state;
}

export function SyncIndicator({ className = "" }: { className?: string }) {
  const online = useOnline();
  const { pending, syncing } = useSyncState();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {online ? (
        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
          <Wifi className="h-3 w-3" /> 🟢 Online
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" /> 🔴 Offline
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {online
          ? pending > 0
            ? "Connected - uploading stored sales."
            : "Connected - All data synchronized."
          : "Offline Mode - Sales are being stored safely on this device."}
      </span>
      {pending > 0 && (
        <button
          type="button"
          onClick={() => { void runSync(); }}
          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white"
        >
          {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
          {pending} pending sync
        </button>
      )}
    </div>
  );
}
