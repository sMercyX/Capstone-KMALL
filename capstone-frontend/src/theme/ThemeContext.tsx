import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  // คำนวณว่าตอนนี้ควรเป็น dark ไหม (ตามระบบถ้าเลือก system)
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const effectiveDark = theme === "dark" || (theme === "system" && prefersDark);

  useEffect(() => {
    // อัปเดต data-theme บน <html>
    const root = document.documentElement;
    root.setAttribute("data-theme", effectiveDark ? "dark" : "light");
    localStorage.setItem("theme", theme);

    // ถ้าผู้ใช้เปลี่ยน theme ของระบบ ขณะเลือก system ให้รีเฟรชสถานะ
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => {
      if (theme === "system") {
        root.setAttribute("data-theme", mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener?.("change", handle);
    return () => mq.removeEventListener?.("change", handle);
  }, [theme, effectiveDark]);

  const value = useMemo(() => ({ theme, setTheme, isDark: effectiveDark }), [theme, effectiveDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
