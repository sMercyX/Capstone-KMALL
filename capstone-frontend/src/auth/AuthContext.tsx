// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"
import { API_BASE } from "../config"

import { useUserApi, type User } from "../api/userApi"
import { useUserStore } from "../stores/userStore"

type AuthContextType = {
  user: User | null
  ready: boolean
  error: string | null
  login: () => void
  logout: () => void
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { getMe } = useUserApi()

  // ฟังก์ชันจาก userStore
  const setUserStore = useUserStore((s) => s.setUser)
  const setRolesStore = useUserStore((s) => s.setRoles)
  const clearUserStore = useUserStore((s) => s.clearUser)

  useEffect(() => {
    ;(async () => {
      try {
        setError(null)

        // 🔹 ยิง /api/users/me แค่ครั้งเดียวที่เว็บโหลด
        const u = await getMe()
        setUser(u)

        // 🔹 sync global store
        setUserStore({
          id: u.id,
          name: u.name,
          email: u.email,
        })

        setRolesStore(u.roles ?? [])
      } catch (err) {
        console.error("load /api/users/me failed", err)

        setUser(null)
        clearUserStore()

        // 401 = ยังไม่ล็อกอิน (ไม่ถือว่า error)
        setError(null)
      } finally {
        setReady(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Login / Logout
  const login = () => {
    const redirect = window.location.href
    const url = `${API_BASE}/oauth2/start?rd=${encodeURIComponent(redirect)}`
    window.location.assign(url)
  }

  const logout = () => {
    window.location.assign(`${API_BASE}/oauth2/sign_out`)
  }

  // เช็ค role แบบ array
  const hasRole = (...roles: string[]) => {
    if (!user) return false
    const lower = user.roles.map((r) => r.toLowerCase())
    return roles.some((r) => lower.includes(r.toLowerCase()))
  }

  const value = useMemo(
    () => ({ user, ready, error, login, logout, hasRole }),
    [user, ready, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
