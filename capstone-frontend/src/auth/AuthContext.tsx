// src/auth/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"
import { decodeJwt, isTokenExpired, makeFakeJwt, msUntilExpiry } from "./jwt" // ตามโค้ดที่ทำไว้

type User = { id: string; name: string; email: string }

type AuthContextType = {
  user: User | null
  token: string | null
  isExpired: boolean
  ready: boolean // ✅ เพิ่มตัวนี้
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState<boolean>(true)
  const [ready, setReady] = useState<boolean>(false) // ✅

  const navigate = useNavigate()
  const expiryTimerRef = useRef<number | null>(null)

  function clearExpiryTimer() {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
  }
  function handleTokenExpired() {
    setIsExpired(true)
    setUser(null)
    setToken(null)
    localStorage.removeItem("auth")
    navigate("/", { replace: true })
  }
  function scheduleExpiryWatcher(jwt: string) {
    clearExpiryTimer()
    const ms = msUntilExpiry(jwt)
    if (ms === 0) return handleTokenExpired()
    expiryTimerRef.current = window.setTimeout(handleTokenExpired, ms)
  }

  // โหลดจาก localStorage ครั้งเดียวหลัง mount
  useEffect(() => {
    const saved = localStorage.getItem("auth")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { user?: User; token?: string }
        const savedToken = parsed.token ?? null
        if (!savedToken || isTokenExpired(savedToken)) {
          handleTokenExpired()
        } else {
          const payload = decodeJwt(savedToken)
          const nextUser: User | null = payload
            ? {
                id: (payload.id || payload.sub || "unknown") as string,
                name: (payload.name || payload.username || "User") as string,
                email: (payload.email || "") as string,
              }
            : parsed.user ?? null

          setUser(nextUser)
          setToken(savedToken)
          setIsExpired(false)
          scheduleExpiryWatcher(savedToken)
        }
      } catch {
        handleTokenExpired()
      }
    }
    setReady(true) // ✅ แจ้งว่าโหลดเสร็จแล้ว ไม่ว่าจะสำเร็จ/ล้มเหลว
    return clearExpiryTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ ใช้ makeFakeJwt ใน login (เดโม่)
  async function login(email: string, password: string) {
    await new Promise((r) => setTimeout(r, 300)) // mock latency

    // mock เงื่อนไขผ่าน
    if (email === "admin@example.com" && password === "123456") {
      const exp = Math.floor(Date.now() / 1000) + 1 * 60 // หมดอายุใน 15 นาที
      const payload = {
        sub: "1",
        id: "1",
        name: "Admin",
        username: "admin",
        email,
        exp,
      }
      const fakeToken = makeFakeJwt(payload)
      const decoded = decodeJwt(fakeToken)!

      const nextUser: User = {
        id: (decoded.id || decoded.sub || "1") as string,
        name: (decoded.name || decoded.username || "Admin") as string,
        email: (decoded.email || email) as string,
      }

      setUser(nextUser)
      setToken(fakeToken)
      setIsExpired(false)
      localStorage.setItem(
        "auth",
        JSON.stringify({ user: nextUser, token: fakeToken })
      )
      scheduleExpiryWatcher(fakeToken)
      return
    }

    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  }
  function logout() {
    clearExpiryTimer()
    setUser(null)
    setToken(null)
    setIsExpired(true)
    localStorage.removeItem("auth")
    navigate("/", { replace: true })
  }

  const value = useMemo(
    () => ({ user, token, isExpired, ready, login, logout }),
    [user, token, isExpired, ready]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
