// src/stores/devModeStore.ts
import { create } from "zustand"

export type DevMode = "seller" | "buyer" | "admin"

const STORAGE_KEY = "kmall_dev_mode"

function getStoredMode(): DevMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "buyer" || stored === "admin" || stored === "seller") {
    return stored
  }
  return "seller" // default
}

interface DevModeState {
  mode: DevMode
  setMode: (m: DevMode) => void
}

export const useDevModeStore = create<DevModeState>((set) => ({
  mode: getStoredMode(),
  setMode: (m) => {
    localStorage.setItem(STORAGE_KEY, m)
    set({ mode: m })
  },
}))

// Helper to get current mode (for use outside React components)
export function getDevMode(): DevMode {
  return localStorage.getItem(STORAGE_KEY) as DevMode || "seller"
}
