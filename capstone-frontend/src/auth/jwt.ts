// src/auth/jwt.ts
import { jwtDecode } from "jwt-decode"

const SKEW_SEC = 5; // กันเวลาคลาดเคลื่อน 5 วิ

export type JwtPayload = {
  sub?: string
  id?: string
  uuid?: string
  name?: string
  username?: string
  display_name?: string
  email?: string
  roles?: string[]
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
  return payload.exp <= (nowSec + SKEW_SEC) // เผื่อเวลา 5 วิ
}

export function msUntilExpiry(token: string): number {
  const payload = decodeJwt(token)
  if (!payload?.exp) return 0
  const nowMs = Date.now()
  const expMs = (payload.exp - SKEW_SEC) * 1000 // เผื่อเวลา 5 วิ
  return Math.max(0, expMs - nowMs)
}