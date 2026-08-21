import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/cashiers")({
  component: CashiersPage,
});

type Staff = {
  id: string;
  full_name: string;
  cashier_id: string | null;
  active: boolean;
  created_at: string;
  role: string;
  email?: string | null;
};

function CashiersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const staff = useQuery({
    queryKey: ["staff", "list"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, cashier_id, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const byUser = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));
      return (profiles ?? []).map((p) => ({
        ...p,
        role: byUser.get(p.id) ?? "cashier",
      })) as Staff[];
    },
  });

  async function cleanLocalCashierData() {
    if (!window.confirm("Clear local transaction and offline queue data on this device?")) return;
    setCleaning(true);
    try {
      localStorage.removeItem("tillpoint.transaction-log.v1");
      localStorage.removeItem("tillpoint.offline-sales.v1");
      toast.success("Local cashier data cleared.");
    } finally {
      setCleaning(false);
    }
  }

  const save = useMutation({
    mutationFn: async (payload: {
      id: string;
      full_name: string;
      cashier_id: string | null;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: payload.full_name,
          cashier_id: payload.cashier_id,
          active: payload.active,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff member updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage everyone with access to your shop.
        </p>
      </header>

      <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">
        <p className="mb-4 text-sm text-muted-foreground">
          To add a cashier: share your shop&apos;s sign-up link with them. New accounts default to
          the cashier role. Emails are managed through the sign-in page (the cashier can reset their
          own email from account settings).
        </p>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div>
            <div className="text-sm font-medium text-amber-950">Device cleanup</div>
            <div className="text-xs text-amber-900/80">
              Remove stale local cashier records before handing this device over.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void cleanLocalCashierData()}
            disabled={cleaning}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> {cleaning ? "Clearing..." : "Clear local data"}
          </Button>
        </div>
        <div className="divide-y divide-blue-100">
          {staff.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : staff.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No staff yet.</p>
            </div>
          ) : (
            staff.data?.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Cashier ID: {s.cashier_id ?? "-"}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge
                    variant={s.role === "manager" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {s.role}
                  </Badge>
                  {s.active ? (
                    <Badge variant="outline" className="border-blue-300 text-blue-700">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                  {s.role !== "manager" && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit staff details</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Cashier ID</Label>
                <Input
                  value={editing.cashier_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, cashier_id: e.target.value })}
                  placeholder="e.g. C-001"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="active">Account active</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Email addresses are managed by the account owner via the sign-in page for security.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editing &&
                save.mutate({
                  id: editing.id,
                  full_name: editing.full_name,
                  cashier_id: editing.cashier_id,
                  active: editing.active,
                })
              }
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
