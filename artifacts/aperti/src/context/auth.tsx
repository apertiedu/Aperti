import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = "/auth";

interface User {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "teacher" | "assistant" | "student" | "parent";
  mustChangePassword?: boolean;
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
  const [token, setToken] = useState<string | null>(localStorage.getItem("aperti_token"));
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        try { return JSON.parse(text); } catch { throw new Error("Non-JSON response from /me"); }
      })
      .then(data => {
        if (data?.user) setUser(data.user);
        else { localStorage.removeItem("aperti_token"); setToken(null); }
      })
      .catch((err: Error) => {
        const was401 = err.message.startsWith("HTTP 401");
        localStorage.removeItem("aperti_token");
        setToken(null);
        if (was401 && user !== null) {
          setSessionExpired(true);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, deviceId: `web-${Date.now()}` }),
      });
    } catch {
      throw new Error("Cannot reach the server — check your connection and try again.");
    }
    const text = await res.text();
    let data: Record<string, any> = {};
    try { data = JSON.parse(text); } catch {
      if (!res.ok) throw new Error(`Server error (${res.status}) — please try again.`);
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
    localStorage.setItem("aperti_token", data.token);
    setToken(data.token);
    setUser(loggedInUser);
    setSessionExpired(false);
    return loggedInUser;
  };

  const logout = () => {
    const t = localStorage.getItem("aperti_token");
    if (t) {
      fetch(`${API}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ deviceId: "web" }),
      }).catch(() => {});
    }
    localStorage.removeItem("aperti_token");
    setToken(null);
    setUser(null);
    setSessionExpired(false);
  };

  const clearMustChangePassword = () =>
    setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);

  const clearSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, clearSessionExpired, login, logout, token, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
