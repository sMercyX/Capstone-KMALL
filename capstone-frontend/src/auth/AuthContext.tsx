import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { API_BASE } from "../config";

import { useUserApi, type User } from "../api/userApi";

type AuthContextType = {
  user: User | null;
  ready: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getMe } = useUserApi();

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const u = await getMe();
        setUser(u);
      } catch (err: any) {
        console.error("load /api/users/me failed", err);
        // 401 = ยังไม่ล็อกอิน → ไม่ต้องถือว่า error
        setUser(null);
        setError(null);
      } finally {
        setReady(true);
      }
    })();

    // getMe มาจาก hook จะไม่ stable → ใช้ [] แล้วปิด eslint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = () => {
    const redirect = window.location.href;
    const url = `${API_BASE}/oauth2/start?rd=${encodeURIComponent(redirect)}`;
    window.location.assign(url);
  };

  const logout = () => {
    window.location.assign(`${API_BASE}/oauth2/sign_out`);
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    const lower = user.roles.map((r) => r.toLowerCase());
    return roles.some((r) => lower.includes(r.toLowerCase()));
  };

  const value = useMemo(
    () => ({ user, ready, error, login, logout, hasRole }),
    [user, ready, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
