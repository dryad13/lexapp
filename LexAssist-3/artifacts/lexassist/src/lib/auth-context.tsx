import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAuthToken, clearAuthToken } from "./queryClient";
import type { UserRole, Department } from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/schema";

interface AuthState {
  authenticated: boolean | null;
  username: string;
  userId: number;
  role: UserRole;
  department: Department;
  organisationId: number;
  displayName: string;
  permissions: typeof ROLE_PERMISSIONS["admin"];
}

interface AuthContextType extends AuthState {
  login: (data: { username: string; role: string; organisationId: number; displayName: string; userId?: number; department?: string }) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  hasPermission: (perm: keyof typeof ROLE_PERMISSIONS["admin"]) => boolean;
}

const defaultPerms = ROLE_PERMISSIONS.read_only;

const AuthContext = createContext<AuthContextType>({
  authenticated: null,
  username: "",
  userId: 0,
  role: "read_only",
  department: "conveyancing",
  organisationId: 0,
  displayName: "",
  permissions: defaultPerms,
  login: () => {},
  logout: () => {},
  refresh: async () => {},
  hasPermission: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    authenticated: null,
    username: "",
    userId: 0,
    role: "read_only",
    department: "conveyancing",
    organisationId: 0,
    displayName: "",
    permissions: defaultPerms,
  });

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setState(prev => ({ ...prev, authenticated: false }));
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const role = (data.role || "read_only") as UserRole;
        setState({
          authenticated: true,
          username: data.username,
          userId: data.userId || 0,
          role,
          department: (data.department || "conveyancing") as Department,
          organisationId: data.organisationId || 0,
          displayName: data.displayName || data.username,
          permissions: ROLE_PERMISSIONS[role] || defaultPerms,
        });
      } else {
        clearAuthToken();
        setState(prev => ({ ...prev, authenticated: false }));
      }
    } catch {
      clearAuthToken();
      setState(prev => ({ ...prev, authenticated: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((data: { username: string; role: string; organisationId: number; displayName: string; userId?: number; department?: string }) => {
    const role = (data.role || "read_only") as UserRole;
    setState({
      authenticated: true,
      username: data.username,
      userId: data.userId || 0,
      role,
      department: (data.department || "conveyancing") as Department,
      organisationId: data.organisationId,
      displayName: data.displayName || data.username,
      permissions: ROLE_PERMISSIONS[role] || defaultPerms,
    });
  }, []);

  const logout = useCallback(() => {
    setState({
      authenticated: false,
      username: "",
      userId: 0,
      role: "read_only",
      department: "conveyancing",
      organisationId: 0,
      displayName: "",
      permissions: defaultPerms,
    });
  }, []);

  const hasPermission = useCallback((perm: keyof typeof ROLE_PERMISSIONS["admin"]) => {
    return !!state.permissions[perm];
  }, [state.permissions]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
