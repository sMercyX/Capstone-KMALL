import { useTheme } from "../../theme/ThemeContext";
import { motion } from "motion/react";

export default function ThemeSwitch2() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 text-xs relative isolate">
      <button
        className={`relative px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 z-10 ${
          theme === "dark" ? "text-white" : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => setTheme("dark")}
      >
        {theme === "dark" && (
          <motion.div
            layoutId="theme-switch-pill"
            className="absolute inset-0 bg-gray-900 rounded-full shadow -z-10"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        Dark
      </button>

      <button
        className={`relative px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 z-10 ${
          theme === "light" ? "text-gray-800" : "text-gray-500 hover:text-gray-900"
        }`}
        onClick={() => setTheme("light")}
      >
        {theme === "light" && (
          <motion.div
            layoutId="theme-switch-pill"
            className="absolute inset-0 bg-white rounded-full shadow -z-10"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        Light
      </button>
    </div>
  );
}
