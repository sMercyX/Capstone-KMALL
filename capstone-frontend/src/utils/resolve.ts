import { API_BASE } from "../config"

export function resolveImageUrl(path?: string | null): string {
  if (!path) {
    return "https://via.placeholder.com/800"
  }

  // ถ้าเป็น absolute URL อยู่แล้ว ก็ใช้เลย
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }

  // แปลง /uploads/... ให้กลายเป็น /api/uploads/...
  let p = path
  if (p.startsWith("/uploads/")) {
    p = "/api" + p        // => /api/uploads/...
  }

  const url = new URL(API_BASE) // เช่น https://.../cp25ssa2/api
  const origin = url.origin     // https://bscit.sit.kmutt.ac.th
  const basePath = url.pathname.replace(/\/api\/?$/, "") // /capstone25/cp25ssa2

  return `${origin}${basePath}${p}`
}
