import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = "/api/auth";

interface User {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "teacher" | "assistant" | "student" | "parent";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("aperti_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else { localStorage.removeItem("aperti_token"); setToken(null); }
      })
      .catch(() => { localStorage.removeItem("aperti_token"); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, deviceId: `web-${Date.now()}` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("aperti_token", data.token);
    setToken(data.token);
    setUser(data.user);
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
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, token }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
