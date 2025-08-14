// src/auth/useAuthGate.ts
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "./AuthContext"

export function useAuthGate() {
  const { user, token, isExpired, ready } = useAuth()
  const navigate = useNavigate()
  const isAuthed = ready && !!(user && token) && !isExpired  // ✅ รวม ready

  const requireNow = useCallback(() => {
    if (!isAuthed) {
      navigate("/", { replace: true })
      return false
    }
    return true
  }, [isAuthed, navigate])

  const guard = useCallback(<T extends (...args: any[]) => any>(fn: T) => {
    return ((...args: Parameters<T>) => {
      if (!isAuthed) {
        navigate("/", { replace: true })
        return
      }
      return fn(...args)
    }) as T
  }, [isAuthed, navigate])

  return { isAuthed, requireNow, guard }
}
