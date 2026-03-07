import { Navigate } from "react-router-dom"
import { useAuth } from "../../auth/AuthContext"
import { useEffect } from "react"
import { toast } from "react-toastify"
import type { JSX } from "react"

interface ProtectedRoleRouteProps {
  children: JSX.Element
  allowedRoles: string[]
  redirectPath?: string
}

export default function ProtectedRoleRoute({ 
  children, 
  allowedRoles, 
  redirectPath = "/" 
}: ProtectedRoleRouteProps) {
  const { ready, user, hasRole } = useAuth()

  if (!ready) {
    return null
  }

  // Use the existing ProtectedRoute behavior to ensure the user is logged in first
  if (!user) {
    return <Navigate to="/" replace />
  }

  // Check if the user has at least one of the allowed roles
  const hasRequiredRole = allowedRoles.length === 0 || hasRole(...allowedRoles)
  
  useEffect(() => {
    if (ready && user && !hasRequiredRole) {
      toast.error("You don't have permission to access this page.", { toastId: "role-denied" })
    }
  }, [ready, user, hasRequiredRole])

  if (!hasRequiredRole) {
    // User does not have the required role → redirect
    return <Navigate to={redirectPath} replace />
  }

  return children
}
