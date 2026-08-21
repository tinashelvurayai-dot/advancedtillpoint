import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerPWA } from "@/lib/pwa-register";
import { PWAStatus } from "@/components/pwa-status";
import { startSyncManager, runSync } from "@/lib/sync-manager";
import { getQueue } from "@/lib/offline-queue";
import { requestPersistentStorage } from "@/lib/offline-db";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">Page not found.</p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TillPoint - Retail Point of Sale" },
      {
        name: "description",
        content: "Modern POS with variant inventory, dual-role dashboards, and real-time stock.",
      },
      { name: "theme-color", content: "#1d4ed8" },
      { property: "og:title", content: "TillPoint - Retail Point of Sale" },
      {
        property: "og:description",
        content: "Modern POS with variant inventory, dual-role dashboards, and real-time stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [reload, setReload] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerPWA((doReload) => setReload(() => doReload));
    void requestPersistentStorage();
    void navigator.storage?.estimate().then(({ usage = 0, quota = 0 }) => {
      if (quota > 0 && usage / quota > 0.8) {
        toast.warning("Device storage is almost full. Please sync your offline sales soon.");
      }
    });
    startSyncManager();
    const onOnline = () => {
      const pending = getQueue().length;
      if (pending > 0) toast.info(`Back online - syncing ${pending} offline sales...`);
      void runSync().then(({ ok, failed }) => {
        if (ok > 0 && failed === 0) toast.success("All offline sales synced successfully!");
        else if (ok > 0 && failed > 0)
          toast.warning(`Synced ${ok} of ${ok + failed} sales. ${failed} failed - will retry.`);
      });
    };

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "RUN_SALES_SYNC") void runSync();
    };
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    window.addEventListener("online", onOnline);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => {
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="page-frame">
        <Outlet />
      </div>
      <PWAStatus reload={reload} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
