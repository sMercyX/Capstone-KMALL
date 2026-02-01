// src/components/DevModeSwitcher/DevModeSwitcher.tsx
import { useDevModeStore, type DevMode } from "../../stores/devModeStore"
import "./DevModeSwitcher.css"

const modes: { value: DevMode; label: string; icon: string }[] = [
  { value: "buyer", label: "Buyer", icon: "🛒" },
  { value: "seller", label: "Seller", icon: "🏪" },
  { value: "admin", label: "Admin", icon: "👑" },
]

export default function DevModeSwitcher() {
  const { mode, setMode } = useDevModeStore()

  const handleChange = (newMode: DevMode) => {
    setMode(newMode)
    // Reload to apply new user context
    window.location.reload()
  }

  return (
    <div className="dev-mode-switcher">
      <span className="dev-mode-label">Dev Mode:</span>
      <div className="dev-mode-buttons">
        {modes.map((m) => (
          <button
            key={m.value}
            className={`dev-mode-btn ${mode === m.value ? "active" : ""}`}
            onClick={() => handleChange(m.value)}
            title={m.label}
          >
            <span className="dev-mode-icon">{m.icon}</span>
            <span className="dev-mode-text">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
