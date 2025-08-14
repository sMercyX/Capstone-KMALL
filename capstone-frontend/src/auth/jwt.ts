import { jwtDecode } from "jwt-decode"

export type JwtPayload = {
  sub?: string
  id?: string
  name?: string
  username?: string
  email?: string
  exp: number // seconds since epoch
  [k: string]: any
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token)
  } catch {
    return null
  }
}

export function isTokenExpired(token?: string | null): boolean {
  if (!token) return true
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  const nowSec = Math.floor(Date.now() / 1000)
  return payload.exp <= nowSec
}

export function msUntilExpiry(token: string): number {
  const payload = decodeJwt(token)
  if (!payload?.exp) return 0
  const nowMs = Date.now()
  const expMs = payload.exp * 1000
  return Math.max(0, expMs - nowMs)
}

// ใช้เฉพาะเดโม่: header.payload.signature แบบ base64 ไม่ต้อง verify
export function makeFakeJwt(payload: Record<string, any>) {
  const h = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
  const p = btoa(JSON.stringify(payload))
  return `${h}.${p}.`
}
