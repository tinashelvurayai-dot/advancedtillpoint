import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { verifyManagerCodes } from "@/lib/manager-codes";
import { setMode } from "@/lib/session-mode";
import { supabase } from "@/integrations/supabase/client";

/** Brand logo that opens the manager console after 7 quick taps + both codes. */
export function ManagerGateLogo() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [busy, setBusy] = useState(false);
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTap() {
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { taps.current = 0; }, 2000);
    if (taps.current >= 7) {
      taps.current = 0;
      setOpen(true);
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!(await verifyManagerCodes(c1, c2))) {
        toast.error("Invalid access codes");
        return;
      }
      setMode("manager");
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await supabase.auth
            .signInAnonymously({ options: { data: { full_name: "Manager" } } })
            .catch(() => undefined);
        }
      }
      setOpen(false);
      navigate({ to: "/manager" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleTap} aria-label="TillPoint" className="select-none rounded-md focus:outline-none">
        <BrandLogo />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manager access</DialogTitle>
            <DialogDescription>Enter both access codes to continue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={unlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-code1">Code 1</Label>
              <Input id="gate-code1" value={c1} onChange={(e) => setC1(e.target.value)} autoComplete="off" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-code2">Code 2</Label>
              <Input id="gate-code2" type="password" value={c2} onChange={(e) => setC2(e.target.value)} autoComplete="off" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Unlocking..." : "Unlock"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
