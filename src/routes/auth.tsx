import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthRedirect,
});

function AuthRedirect() {
  const { session, role, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (session && role === "manager") return <Navigate to="/manager" />;
  if (session && role === "cashier") return <Navigate to="/cashier" />;
  return <Navigate to="/" />;
}
