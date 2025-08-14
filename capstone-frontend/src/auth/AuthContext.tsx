import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // โหลดสถานะจาก localStorage (จำ session ไว้)
  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed.user ?? null);
      setToken(parsed.token ?? null);
    }
  }, []);

  // mock login: อนุญาต email: admin@example.com / pass: 123456
  async function login(email: string, password: string) {
    await new Promise((r) => setTimeout(r, 500)); // จำลองดีเลย์ API
    if (email === "admin@example.com" && password === "123456") {
      const fakeUser: User = { id: "1", name: "Admin", email };
      const fakeToken = "fake_jwt_token";
      setUser(fakeUser);
      setToken(fakeToken);
      localStorage.setItem("auth", JSON.stringify({ user: fakeUser, token: fakeToken }));
    } else {
      throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth");
  }

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
