import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configurationError: string | null;
  sessionExpired: boolean;
  signOut: (scope?: "global" | "local") => Promise<void>;
  markSessionExpired: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
