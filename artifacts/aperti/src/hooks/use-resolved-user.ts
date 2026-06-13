import { useAuth } from "@/context/auth";

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
  const { user, loading } = useAuth();
  const resolvedUser = (user ?? null) as ResolvedUser | null;

  return {
    user: resolvedUser,
    isLoading: loading,
    isAuthenticated: !!resolvedUser,
    isAdmin: resolvedUser?.role === "admin",
    isTeacher: resolvedUser?.role === "teacher",
    isStudent: resolvedUser?.role === "student",
    isParent: resolvedUser?.role === "parent",
  };
}
