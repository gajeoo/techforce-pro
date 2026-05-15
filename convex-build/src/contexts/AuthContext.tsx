import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "manager" | "supervisor" | "technician" | "customer";

export interface AuthUser {
  role: UserRole;
  name: string;
  employeeId?: string;
  customerId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (role: UserRole, name: string, employeeId?: string, customerId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "tfpro_convex_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (role: UserRole, name: string, employeeId?: string, customerId?: string) => {
    const u: AuthUser = { role, name, employeeId, customerId };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
