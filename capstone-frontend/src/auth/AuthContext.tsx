// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"

import { useUserApi, type User } from "../api/userApi"
import { useUserStore } from "../stores/userStore"
import { msalInstance } from "../auth/msalConfig"
import { setAccessToken } from "../auth/tokenStore"

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

  const setUserStore = useUserStore((s) => s.setUser)
  const setRolesStore = useUserStore((s) => s.setRoles)
  const clearUserStore = useUserStore((s) => s.clearUser)

  useEffect(() => {
    ;(async () => {
      try {
        setError(null)

        console.log("[AUTH] init MSAL...")
        await msalInstance.initialize()
        console.log("[AUTH] MSAL initialized")

        // 1) เคลียร์ state redirect ของ MSAL
        const redirectResult = await msalInstance.handleRedirectPromise()
        console.log("[AUTH] redirectResult:", redirectResult)

        if (redirectResult && redirectResult.account) {
          msalInstance.setActiveAccount(redirectResult.account)
          console.log("[AUTH] set active account from redirect")
        }

        // 2) หา account ปัจจุบัน
        const account =
          msalInstance.getActiveAccount() ||
          msalInstance.getAllAccounts()[0]

        console.log("[AUTH] active account:", account)

        if (!account) {
          console.log("[AUTH] no account → not logged in")
          setUser(null)
          clearUserStore()
          setAccessToken(null)
          return
        }

        // 3) ขอ token แบบ silent
        const result = await msalInstance.acquireTokenSilent({
          account,
          scopes: ["openid", "profile", "email"],
        })

        // idToken จะมี claim OIDC ครบ และ aud = clientId
        const rawIdToken = result.idToken;  // ⭐ ตรงนี้แหละสำคัญ

        console.log(
          "[AUTH] got id_token:",
          rawIdToken ? rawIdToken.slice(0, 20) + "..." : "none"
        )

        setAccessToken(rawIdToken)



        // 4) โหลด /api/users/me
        console.log("[AUTH] calling /api/users/me ...")
        const u = await getMe()
        console.log("[AUTH] /api/users/me OK:", u)

        setUser(u)

        setUserStore({
          id: u.id,
          name: u.name,
          email: u.email,
        })
        setRolesStore(u.roles ?? [])
      } catch (err: any) {
        console.error("load /api/users/me (via MSAL token) failed", err)

        setUser(null)
        clearUserStore()
        setAccessToken(null)
        setError(null)
      } finally {
        setReady(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = () => {
    console.log("[AUTH] loginRedirect() called")
    msalInstance
      .loginRedirect({
        scopes: ["openid", "profile", "email"],
      })
      .catch((e: any) => {
        if (e?.errorCode === "interaction_in_progress") {
          console.warn("[AUTH] interaction_in_progress, ignore duplicate login")
          return
        }
        console.error("loginRedirect error:", e)
        setError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง")
      })
  }

  const logout = () => {

    console.log("[AUTH] logoutRedirect() called")
    setUser(null)
    clearUserStore()
    setRolesStore([])
    setAccessToken(null)

    msalInstance.logoutRedirect().catch((e) => {
      console.error("logoutRedirect error:", e)
    })

    // const appLogout = import.meta.env.VITE_AUTH_LOGOUT
    // const msLogout = import.meta.env.VITE_MS_LOGOUT
    // const feBase = import.meta.env.VITE_FE_BASE

    // if (appLogout && msLogout && feBase) {
    //   window.location.assign(`${appLogout}?rd=${feBase}`)
    // } else {
    //   window.location.assign(`${appLogout}?rd=${feBase}`)
    // }

  }

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
