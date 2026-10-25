import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { StaffProfile } from "./types";

// Staff type a short staff ID ("gerwyn"); Supabase logins are email based, so
// each ID maps to an internal address that never receives mail.
export const STAFF_EMAIL_DOMAIN = "staff.drinksorder.app";
export const staffEmail = (staffId: string) =>
  `${staffId.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: StaffProfile | null;
  signIn: (staffId: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("staff_profiles")
      .select("user_id, staff_code, display_name, role, is_device, active")
      .eq("user_id", s.user.id)
      .maybeSingle();
    setProfile((data as StaffProfile | null) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer the profile query so it never runs inside the auth callback.
      setTimeout(() => void loadProfile(s), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (staffId: string, password: string) => {
      if (!/^[a-z0-9._-]{2,32}$/i.test(staffId.trim())) {
        return "Staff IDs are letters and numbers only, like gerwyn.";
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: staffEmail(staffId),
        password,
      });
      if (error) {
        return error.message.toLowerCase().includes("invalid")
          ? "That staff ID or password isn't right."
          : "Couldn't sign in. Check your connection and try again.";
      }
      await loadProfile(data.session);
      return null;
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, profile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const isManagerRole = (p: StaffProfile | null) =>
  !!p && p.active && (p.role === "owner" || p.role === "manager");
export const isOwnerRole = (p: StaffProfile | null) => !!p && p.active && p.role === "owner";
