import { useContext } from "react";
import { AuthContext } from "@/context/auth";

export interface ResolvedUser {
  id: number;
  username: string;
  role: "admin" | "teacher" | "student" | "parent";
  displayName?: string;
  email?: string;
  mustChangePassword?: boolean;
}

export function useResolvedUser(): {
  user: ResolvedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
} {
  const ctx = useContext(AuthContext);
  const user = (ctx?.user ?? null) as ResolvedUser | null;
  const isLoading = ctx?.isLoading ?? true;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isTeacher: user?.role === "teacher",
    isStudent: user?.role === "student",
    isParent: user?.role === "parent",
  };
}
