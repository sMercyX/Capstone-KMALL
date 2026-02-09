// src/auth/tokenStore.ts

export type UserIdentity = {
  uid?: string
  email?: string
  name?: string
}

const TOKEN_KEY = "_kmall_access_token"
const IDENTITY_KEY = "_kmall_identity"

// backup ใน memory เผื่อกรณีใช้ sessionStorage ไม่ได้ (เช่น SSR / test)
let memoryToken: string | null = null
let memoryIdentity: UserIdentity | null = null

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * เก็บ access token ไว้ใน sessionStorage (ถ้าใช้ไม่ได้จะเก็บใน memory แทน)
 */
export function setAccessToken(token: string | null) {
  const storage = getSessionStorage()
  memoryToken = token

  if (!storage) return

  if (token) {
    storage.setItem(TOKEN_KEY, token)
  } else {
    storage.removeItem(TOKEN_KEY)
  }
}

/**
 * ดึง access token
 */
export function getAccessToken(): string | null {
  const storage = getSessionStorage()
  if (!storage) return memoryToken
  return storage.getItem(TOKEN_KEY) ?? memoryToken
}

/**
 * เก็บ identity (uid/email/name) ไว้ใน sessionStorage
 */
export function setUserIdentity(identity: UserIdentity | null) {
  const storage = getSessionStorage()
  memoryIdentity = identity

  if (!storage) return

  if (identity) {
    storage.setItem(IDENTITY_KEY, JSON.stringify(identity))
  } else {
    storage.removeItem(IDENTITY_KEY)
  }
}

/**
 * ดึง identity (uid/email/name)
 */
export function getUserIdentity(): UserIdentity | null {
  const storage = getSessionStorage()
  if (!storage) return memoryIdentity

  const raw = storage.getItem(IDENTITY_KEY)
  if (!raw) return memoryIdentity

  try {
    return JSON.parse(raw) as UserIdentity
  } catch {
    return memoryIdentity
  }
}
