import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function PWAInstallButton(props: ButtonProps & { label?: string }) {
  const { label = "Install app", ...btnProps } = props;
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (isStandalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setEvt(deferredInstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (deferredInstallPrompt) setEvt(deferredInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    const promptEvent = evt ?? deferredInstallPrompt;
    if (!promptEvent) {
      toast.message("How to install", {
        description:
          "On Chrome/Android: open this published site, then use the browser Install option if the prompt is not ready yet. On iPhone: tap Share, then Add to Home Screen.",
      });
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") toast.success("Installing...");
    deferredInstallPrompt = null;
    setEvt(null);
  }

  return (
    <Button {...btnProps} type="button" onClick={handleClick}>
      <Download className="mr-2 h-4 w-4" /> {label}
    </Button>
  );
}
