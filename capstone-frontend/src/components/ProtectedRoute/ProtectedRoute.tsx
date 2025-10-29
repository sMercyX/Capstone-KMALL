// src/components/ProtectedRoute/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import type { JSX } from "react";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { ready, ensureFreshToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      // ขอ access token ที่ "สด" เสมอ (ถ้าใกล้หมดอายุจะ refresh ให้เอง)
      const fresh = await ensureFreshToken();
      setAllowed(!!fresh);
    })();
  }, [ready, ensureFreshToken]);

  if (!ready || allowed === null) return null; // จะใส่ spinner ตรงนี้ก็ได้
  return allowed ? children : <Navigate to="/" replace />;
}
