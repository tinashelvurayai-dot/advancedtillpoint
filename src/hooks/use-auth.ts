import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_KEY = "tillpoint.auth.profile.v1";
const AUTH_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), AUTH_TIMEOUT_MS)),
  ]);
}

function readCachedProfile(): { profile: AuthProfile | null; role: AppRole | null } {
  try {
    const cached = JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) ?? "null") as {
      profile?: AuthProfile | null;
      role?: AppRole | null;
    } | null;
    return { profile: cached?.profile ?? null, role: cached?.role ?? null };
  } catch {
    return { profile: null, role: null };
  }
}

export type AppRole = "manager" | "cashier";

export interface AuthProfile {
  id: string;
  full_name: string;
  cashier_id: string | null;
  active: boolean;
}

export interface AuthState {
  session: Session | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const cached = readCachedProfile();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(cached.profile);
  const [role, setRole] = useState<AppRole | null>(cached.role);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData(s: Session | null) {
      if (!s) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const [{ data: p }, { data: r }] = await withTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, cashier_id, active")
              .eq("id", s.user.id)
              .maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", s.user.id).maybeSingle(),
          ]),
          [{ data: null }, { data: null }] as never,
        );
        if (cancelled) return;
        const nextProfile = p as AuthProfile | null;
        const nextRole = (r?.role as AppRole) ?? null;
        setProfile(nextProfile);
        setRole(nextRole);
        try {
          localStorage.setItem(
            AUTH_CACHE_KEY,
            JSON.stringify({ profile: nextProfile, role: nextRole }),
          );
        } catch {
          /* best effort */
        }
      } catch {
        // Offline or transient failure - resolve loading so gated routes render.
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }).then(
      ({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        void loadUserData(data.session);
      },
    );

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(true);
      // Defer to avoid deadlock
      setTimeout(() => loadUserData(s), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, role, loading };
}
