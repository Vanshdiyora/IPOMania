import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [configurationError] = useState(
    supabase
      ? null
      : "Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
  const sessionRef = useRef<Session | null>(null);
  const intentionalSignOut = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT" && sessionRef.current && !intentionalSignOut.current) {
        setSessionExpired(true);
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (nextSession) setSessionExpired(false);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Unable to restore the authentication session.", { name: error.name });
      }
      sessionRef.current = data.session;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async (scope: "global" | "local" = "global") => {
    if (!supabase) return;
    intentionalSignOut.current = true;
    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error) throw error;
    } finally {
      intentionalSignOut.current = false;
    }
    sessionRef.current = null;
    setSession(null);
    setSessionExpired(false);
  }, []);

  const markSessionExpired = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setSessionExpired(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        configurationError,
        sessionExpired,
        signOut,
        markSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
