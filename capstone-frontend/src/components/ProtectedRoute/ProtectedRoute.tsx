// src/components/ProtectedRoute/ProtectedRoute.tsx
import { Navigate } from "react-router-dom"
import { useAuth } from "../../auth/AuthContext"
import type { JSX } from "react"

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, token, isExpired, ready } = useAuth()

  // ⏳ ยังโหลดไม่เสร็จ อย่าเพิ่ง redirect
  if (!ready) {
    return null // หรือใส่ Skeleton/Spinner ก็ได้
  }

  const authed = !!(user && token) && !isExpired
  if (!authed) {
    return <Navigate to="/" replace />
  }

  return children
}
