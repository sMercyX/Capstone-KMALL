// src/components/ProtectedRoute/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { JSX } from "react";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { ready, user } = useAuth();

  if (!ready) {
    // จะใส่ spinner ก็ได้
    return null;
  }

  if (!user) {
    // ยังไม่ได้ login → เด้งไปหน้า LandingPage (สมมติ path = /)
    return <Navigate to="/" replace />;
  }

  return children;
}
