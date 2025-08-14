import { useTheme } from "../../theme/ThemeContext";

export default function ThemeSwitch() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span>{isDark ? "🌙" : "☀️"}</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        style={{ padding: "6px 8px", borderRadius: 8 }}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
