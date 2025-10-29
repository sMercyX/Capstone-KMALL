import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"
import { decodeJwt, isTokenExpired, msUntilExpiry } from "./jwt"
import { API_BASE } from "../config" // <- มีตามที่ตั้งไว้ก่อนหน้า

type User = { 
  id: string; 
  name: string; 
  email: string 
  // roles: string[];
}

type AuthContextType = {
  user: User | null
  token: string | null
  isExpired: boolean
  ready: boolean
  /** คืน access token ที่ “สด” เสมอ (จะ refresh ให้ถ้าใกล้หมดอายุ) */
  ensureFreshToken: () => Promise<string | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState<boolean>(true)
  const [ready, setReady] = useState<boolean>(false)
  const navigate = useNavigate()
  const expiryTimerRef = useRef<number | null>(null)

  // ---------- helpers ----------
  function clearExpiryTimer() {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
  }

  function userFromPayload(p: any): User {
    return {
      id: (p.id || p.sub || p.uuid || "unknown") as string,
      name: (p.name || p.username || p.display_name || "User") as string,
      email: (p.email || "") as string,
      //  roles: Array.isArray(p.roles) ? p.roles : [],
    }
  }

  function applyLoginWithToken(jwt: string) {
    const payload = decodeJwt(jwt)
    if (!payload) throw new Error("invalid token")
    const nextUser = userFromPayload(payload)
    setUser(nextUser)
    setToken(jwt)
    setIsExpired(false)
    localStorage.setItem("auth", JSON.stringify({ user: nextUser, token: jwt }))
    scheduleRefresh(jwt) 
  }

  function handleLoggedOut() {
    clearExpiryTimer()
    setIsExpired(true)
    setUser(null)
    setToken(null)
    localStorage.removeItem("auth")
  }

  function logout() {
    handleLoggedOut()
    navigate("/", { replace: true })
  }

  // อ่าน access จาก URL hash: #access=...&token_type=Bearer
  function readAccessFromHash(): string | null {
    const hash = window.location.hash || ""
    if (!hash.startsWith("#")) return null
    const params = new URLSearchParams(hash.slice(1))
    return params.get("access")
  }

  // ตั้ง timer ให้ refresh ก่อนหมดอายุ (เช่น 30s)
  function scheduleRefresh(jwt: string) {
    clearExpiryTimer()
    const margin = 30_000 // refresh ก่อนหมดอายุ 30 วินาที
    let ms = msUntilExpiry(jwt) - margin
    if (ms < 0) ms = 0
    expiryTimerRef.current = window.setTimeout(() => {
      // เรียก refresh แบบเงียบๆ
      void tryRefresh()
    }, ms)
  }

  // ---------- refresh flow ----------
  async function tryRefresh(): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include", // สำคัญ: ส่ง cookie rt ไป
        headers: { "content-type": "application/json" },
        body: "{}",
      })

      if (!res.ok) {
        // 401 / 400 -> refresh token ใช้ไม่ได้แล้ว
        handleLoggedOut()
        return null
      }

      const data = (await res.json()) as { access_token?: string; token_type?: string }
      const newToken = data.access_token
      if (!newToken) {
        handleLoggedOut()
        return null
      }

      applyLoginWithToken(newToken)
      return newToken
    } catch {
      // เน็ตล่ม/เซิร์ฟเวอร์ล้ม — อย่า logout ทันที ให้คงสถานะไว้
      return null
    }
  }

  // ให้ภายนอกเรียกเพื่อขอ token ที่สดเสมอ
  async function ensureFreshToken(): Promise<string | null> {
    if (!token) {
      // อาจมี cookie rt แต่ยังไม่มี access ใน FE -> ลอง refresh ครั้งแรก
      return await tryRefresh()
    }
    const ms = msUntilExpiry(token)
    if (ms <= 5_000) {
      return await tryRefresh()
    }
    return token
  }

  
  // ---------- init ----------
  useEffect(() => {
    (async () => {
      try {
        // 1) token จาก URL hash (มาจาก BE callback)
        const fromHash = readAccessFromHash()
        if (fromHash) {
          applyLoginWithToken(fromHash)
          // ล้าง fragment ออกจาก URL
          const { pathname, search } = window.location
          window.history.replaceState(null, "", pathname + search)
          setReady(true)
          return
        }

        // 2) token จาก localStorage
        const saved = localStorage.getItem("auth")
        if (saved) {
          const parsed = JSON.parse(saved) as { user?: User; token?: string }
          const savedToken = parsed.token ?? null
          if (savedToken && !isTokenExpired(savedToken)) {
            applyLoginWithToken(savedToken)
            setReady(true)
            return
          }
        }

        // 3) ไม่มี/หมดอายุ -> ขอใหม่ด้วย refresh cookie
        await tryRefresh()
      } finally {
        setReady(true)
      }
    })()

    return () => clearExpiryTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ user, token, isExpired, ready, ensureFreshToken, logout }),
    [user, token, isExpired, ready]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

