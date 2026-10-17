import type { User } from "@golf-coach/shared-types";
import { createContext, useContext, useState, type PropsWithChildren } from "react";

const TOKEN_KEY = "golf-coach.token";
const USER_KEY = "golf-coach.user";

interface AuthState {
  token: string | null;
  user: User | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// localStorage can throw (private mode, blocked storage); auth then just
// lasts for the tab's lifetime.
function readStored(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    if (token && user) return { token, user: JSON.parse(user) };
  } catch {
    // ignore
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(readStored);

  const signIn = (token: string, user: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
    setState({ token, user });
  };

  const signOut = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    setState({ token: null, user: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
