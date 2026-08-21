import { createFileRoute, Link, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SignOutButton } from "@/components/sign-out-button";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  Receipt,
  BookOpen,
  Menu,
  X,
  Wallet,
  TrendingUp,
  Truck,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  Lock as LockIcon,
  HardDrive,
  Settings,
  Undo2,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isManagerMode } from "@/lib/session-mode";
import { SyncAlertBanner } from "@/components/sync-alert-banner";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerLayout,
});

const navItems: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/manager/products", label: "Products", icon: Package },
  { to: "/manager/stock", label: "Stock", icon: Boxes },
  { to: "/manager/stock-in", label: "Stock-In Records", icon: ClipboardList },
  { to: "/manager/alerts", label: "Low Stock Alerts", icon: AlertTriangle },
  { to: "/manager/sales", label: "Sales", icon: Receipt },
  { to: "/manager/refunds", label: "Refunds & Voids", icon: Undo2 },
  { to: "/manager/profit", label: "Profit View", icon: TrendingUp },
  { to: "/manager/cash", label: "Daily Cash", icon: Wallet },
  { to: "/manager/expenses", label: "Expenses & Profit", icon: TrendingUp },
  { to: "/manager/suppliers", label: "Suppliers & PO", icon: Truck },
  { to: "/transactions", label: "Transaction Log", icon: ClipboardList },
  { to: "/sync", label: "Sync Queue", icon: RefreshCw },
  { to: "/shift", label: "Shift Close (Z)", icon: LockIcon },
  { to: "/orders", label: "Orders", icon: ClipboardList },

  { to: "/manager/storage", label: "Storage & Exports", icon: HardDrive },
  { to: "/manager/settings", label: "Settings", icon: Settings },
  { to: "/manager/logs", label: "Reset Logs", icon: ScrollText },
  { to: "/manager/manuals", label: "Manuals", icon: BookOpen },
];

function ManagerLayout() {
  const { role, profile, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  const unlocked = isManagerMode();
  if (role !== "manager" && !unlocked) return <Navigate to="/cashier" />;

  const SidebarInner = (
    <>
      <div className="px-6 py-5">
        <BrandLogo />
        <div className="mt-1 pl-[46px] text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
          Manager console
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to as "/manager"}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-200/70 hover:text-blue-700",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-300/60 p-4">
        <div className="mb-3 text-sm">
          <div className="font-medium text-slate-900">
            {profile?.full_name ?? "Mr Pride Tatire"}
          </div>
          <div className="text-xs text-slate-500">Manager</div>
        </div>
        <SignOutButton variant="outline" />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col overflow-y-auto overscroll-contain border-r border-slate-300/60 bg-gradient-to-b from-slate-100 to-blue-50 md:flex">
        {SidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <BrandLogo />
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col overflow-y-auto overscroll-contain bg-gradient-to-b from-slate-100 to-blue-50 shadow-xl">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {SidebarInner}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <SyncAlertBanner />
        <Outlet />
      </main>
    </div>
  );
}
