// src/auth/useAuthGate.ts
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext"; // ของเดิมที่คุณมีอยู่

export function useAuthGate() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthed = !!(user && token);

  // ใช้เช็คแบบทันทีใน handler (return true = ไปต่อ, false = โดนเด้ง)
  const requireNow = useCallback(() => {
    if (!isAuthed) {
      navigate("/login", { replace: true, state: { from: location } });
      return false;
    }
    return true;
  }, [isAuthed, navigate, location]);

  // ใช้หุ้มฟังก์ชัน เช่น onClick/onSubmit แบบสะดวก ๆ
  const guard = useCallback(<T extends (...args: any[]) => any>(fn: T) => {
    return ((...args: Parameters<T>) => {
      if (!isAuthed) {
        navigate("/login", { replace: true, state: { from: location } });
        return;
      }
      return fn(...args);
    }) as T;
  }, [isAuthed, navigate, location]);

  return { isAuthed, requireNow, guard };
}
