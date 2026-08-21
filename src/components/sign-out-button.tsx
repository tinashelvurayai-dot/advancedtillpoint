import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" | "default" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function handle() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handle}
      className="!text-black hover:!bg-transparent hover:!text-black focus-visible:!bg-transparent"
    >
      <LogOut className="mr-2 h-4 w-4" /> Sign out
    </Button>
  );
}
