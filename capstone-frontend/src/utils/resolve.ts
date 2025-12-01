// src/utils/resolve.ts
import { API_BASE } from "../config"

export function resolveImageUrl(path?: string | null): string {
  if (!path) {
    return "https://via.placeholder.com/800"
  }

  // ถ้าเป็น absolute URL อยู่แล้ว -> ใช้เลย
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }

  const apiUrl = new URL(API_BASE) // เช่น https://bscit.../cp25ssa2/api
  const origin = apiUrl.origin     // https://bscit.sit.kmutt.ac.th
  const basePath = apiUrl.pathname.replace(/\/api\/?$/, "") // /capstone25/cp25ssa2

  // ให้แน่ใจว่า path มี / นำหน้า
  let p = path
  if (!p.startsWith("/")) {
    p = "/" + p
  }

  // สุดท้าย: https://.../capstone25/cp25ssa2/uploads/...
  return `${origin}${basePath}${p}`
}
