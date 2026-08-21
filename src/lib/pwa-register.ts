// Guarded service worker registration for offline support.
// Never registers in Lovable preview/dev/iframe contexts.

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (!import.meta.env.PROD) return true;
    if (window.self !== window.top) return true;
    const h = window.location.hostname;
    if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
    if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
    if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
    if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sw") === "off") return true;
  } catch {
    /* noop */
  }
  return false;
}

async function unregisterAppSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || "";
      if (url.endsWith("/sw.js")) await r.unregister();
    }
  } catch {
    /* noop */
  }
}

export function registerPWA(onUpdate?: (reload: () => void) => void) {
  if (typeof window === "undefined") return;
  if (isPreviewOrDev()) {
    void unregisterAppSW();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        try {
          await navigator.storage?.persist?.();
          await (
            reg as ServiceWorkerRegistration & {
              sync?: { register: (tag: string) => Promise<void> };
            }
          ).sync?.register("tillpoint-sales");
        } catch {
          // Storage and Background Sync are progressive enhancements.
        }
        function watch(worker: ServiceWorker | null) {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller && onUpdate) {
              onUpdate(() => {
                worker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              });
            }
          });
        }
        if (reg.waiting && navigator.serviceWorker.controller && onUpdate) {
          onUpdate(() => {
            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }
        reg.addEventListener("updatefound", () => watch(reg.installing));
      })
      .catch(() => {
        /* noop */
      });
  });
}
