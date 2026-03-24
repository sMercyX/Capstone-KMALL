// src/api/fetch.ts
import { API_BASE } from "../config"
import {
  getAccessToken,
  getUserIdentity,
  type UserIdentity,
} from "../auth/tokenStore"

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"

type AuthMode = "auto" | "required" | "none"

type ExtraOptions = {
  auth?: AuthMode
  headers?: HeadersInit
  credentials?: RequestCredentials
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "") // ตัด / ท้าย base
  const p = path.replace(/^\/+/, "") // ตัด / หน้า path
  return `${b}/${p}` // ต่อให้เหลือ / เดียว
}

// ⭐ helper: แนบ uid / email / name ลงใน Headers ของ fetch
function attachUserHeadersFetch(h: Headers, identity: UserIdentity | null) {
  if (!identity) return
  const { uid, email, name } = identity

  if (uid && !h.has("uid")) {
    h.set("uid", uid)
  }
  if (email && !h.has("email")) {
    h.set("email", email)
  }
  if (name && !h.has("name")) {
    h.set("name", name)
  }
}

// ⭐ helper: แนบ X-Dev-User header สำหรับ dev mode
function getDevModeHeader(): string {
  return localStorage.getItem("kmall_dev_mode") || "seller"
}

// ==============================
// 1) HTTP Client (fetch-based)
// ==============================
export function useHttpClient(baseUrl: string) {
  async function fetchData(
    path: string,
    options: RequestInit & ExtraOptions = {}
  ) {
    const { auth = "auto", headers = {}, credentials, ...rest } = options

    const url = joinUrl(baseUrl, path)
    const h = new Headers(headers)

    // ⭐ แนบ Bearer token ถ้าไม่ใช่ auth="none"
    if (auth !== "none") {
      const token = getAccessToken()
      if (token && !h.has("Authorization")) {
        h.set("Authorization", `Bearer ${token}`)
      }
    }

    // ⭐ แนบ uid / email / name จาก MSAL
    const identity = getUserIdentity()
    attachUserHeadersFetch(h, identity)

    // ⭐ แนบ X-Dev-User header สำหรับ dev mode
    if (!h.has("X-Dev-User")) {
      h.set("X-Dev-User", getDevModeHeader())
    }

    // ตั้ง Content-Type ให้อัตโนมัติถ้าเป็น JSON
    if (rest.body && !h.has("Content-Type") && !isFormData(rest.body)) {
      h.set("Content-Type", "application/json")
    }

    // ใช้ same-origin พอ เพราะเรา auth ด้วย Bearer token แล้ว
    const finalCredentials: RequestCredentials | undefined =
      credentials ?? "same-origin"

    const res = await fetch(url, {
      ...rest,
      headers: h,
      credentials: finalCredentials,
    })

    if (res.status === 401 && auth === "required") {
      const err = new Error("Unauthorized")
      // @ts-expect-error
      err.code = 401
      throw err
    }

    if (!res.ok) {
      let errorData: any
      try {
        const ct = res.headers.get("content-type")
        if (ct && ct.includes("application/json")) {
          errorData = await res.json()
        } else {
          errorData = await res.text()
        }
      } catch (e) {
        errorData = null
      }

      const error = new Error(
        (errorData && errorData.message) || `HTTP error! Status: ${res.status}`
      )
      ;(error as any).response = {
        status: res.status,
        data: errorData,
      }
      throw error
    }

    const ct = res.headers.get("content-type")
    if (ct && ct.includes("application/json")) return res.json()
    return res.text()
  }

  const getItems = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "GET", ...opt })

  const postItem = (url: string, item?: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, {
      method: "POST",
      body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}),
      ...opt,
    })

  const putItem = (url: string, item: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, {
      method: "PUT",
      body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}),
      ...opt,
    })

  const deleteItem = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "DELETE", ...opt })

  const patchItem = (url: string, item?: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, {
      method: "PATCH",
      body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}),
      ...opt,
    })

  return { getItems, postItem, putItem, deleteItem, patchItem }
}

export function useCrudApi() {
  let baseUrl = import.meta.env.VITE_API_BASE || API_BASE
  baseUrl = baseUrl.replace(/\/+$/, "")
  return useHttpClient(baseUrl)
}

// ==============================
// 2) Axios Client (ใหม่)
// ==============================

let axiosInstance: AxiosInstance | null = null

// ⭐ helper: สร้าง axios instance พร้อมแนบ token + user header อัตโนมัติ
function createAxiosInstance(baseUrl: string): AxiosInstance {
  const instance = axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    withCredentials: true,
  })

  // Request interceptor: แนบ Authorization + uid/email/name
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()

    // ให้แน่ใจว่ามี headers ก่อน
    if (!config.headers) {
      config.headers = {} as any
    }

    const headers = config.headers as any

    // ⭐ Authorization
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`
    }

    // ⭐ uid / email / name
    const identity = getUserIdentity()
    if (identity) {
      const { uid, email, name } = identity
      if (uid && !headers["uid"]) {
        headers["uid"] = uid
      }
      if (email && !headers["email"]) {
        headers["email"] = email
      }
      if (name && !headers["name"]) {
        headers["name"] = name
      }
    }

    // ⭐ X-Dev-User header สำหรับ dev mode
    if (!headers["X-Dev-User"]) {
      headers["X-Dev-User"] = localStorage.getItem("kmall_dev_mode") || "seller"
    }

    return config
  })

  return instance
}

// ใช้ตัวนี้เวลาอยากเรียก axios แทน fetch client
export function useAxiosApi(): AxiosInstance {
  let baseUrl = import.meta.env.VITE_API_BASE || API_BASE
  baseUrl = baseUrl.replace(/\/+$/, "")

  if (!axiosInstance) {
    axiosInstance = createAxiosInstance(baseUrl)
  }

  return axiosInstance
}
