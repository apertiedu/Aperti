import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = "/auth";

export type UserRole = "admin" | "teacher" | "assistant" | "student" | "parent" | "guest";

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  status: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  token: string | null;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    fetch(`${API}/me`, { credentials: "include" })
      .then(async res => {
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        try { return JSON.parse(text); } catch { throw new Error("Non-JSON from /me"); }
      })
      .then(data => { if (data?.user) setUser(data.user); })
      .catch((err: Error) => {
        const was401 = err.message.startsWith("HTTP 401");
        if (was401 && user !== null) setSessionExpired(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, deviceId: `web-${Date.now()}` }),
      });
    } catch {
      throw new Error("Cannot reach the server — check your connection and try again.");
    }
    const text = await res.text();
    let data: Record<string, any> = {};
    try {
      if (!text.trim()) throw new SyntaxError("empty");
      if (text.trimStart()[0] !== "{" && text.trimStart()[0] !== "[") throw new SyntaxError("not-json");
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok ? "Unexpected server response — please try again." : `Server error (${res.status}) — please try again.`
      );
    }
    if (!res.ok) {
      const msg =
        res.status === 401 ? (data.error || "Incorrect username or password") :
        res.status === 403 ? (data.error || "Access denied.") :
        res.status === 429 ? "Too many failed login attempts. Please wait 10 minutes and try again." :
        res.status >= 500 ? "Server error — please try again in a moment." :
        data.error || "Login failed";
      const err: any = new Error(msg);
      err.suspended = data.suspended === true;
      err.deviceLimitReached = data.deviceLimitReached === true;
      err.rateLimited = data.rateLimited === true || res.status === 429;
      throw err;
    }
    const loggedInUser = data.user as User;
    setUser(loggedInUser);
    setSessionExpired(false);
    return loggedInUser;
  };

  const logout = () => {
    fetch(`${API}/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "web" }),
    }).catch(() => {});
    setUser(null);
    setSessionExpired(false);
  };

  const clearMustChangePassword = () =>
    setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);
  const clearSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, clearSessionExpired, login, logout, token: null, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const useRole = (): UserRole => {
  const { user } = useContext(AuthContext);
  return user?.role ?? "guest";
};

export const useIsRole = (...roles: UserRole[]): boolean => {
  const role = useRole();
  return roles.includes(role);
};
