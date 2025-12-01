// src/api/userApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

// ====== RAW TYPES จาก BE ======
export interface UserResponse {
  ID: string
  MSID: string
  Email: string
  DisplayName: string
  CreatedAt: string
  UpdatedAt: string
  LastLogin: string
}

// data เฉพาะของ /api/users/me
export interface MeData {
  roles: string[]
  user: UserResponse
}

// response ของ /api/users/me = wrapper + MeData
export type GetUserResponse = ApiResponse<MeData>

// ====== FE-friendly User ======
export interface User {
  id: string
  msid: string
  email: string
  name: string
  roles: string[]
  createdAt: string
  updatedAt: string
  lastLogin: string
}

// map จาก GetUserResponse (BE) → User (FE)
export function mapUser(response: GetUserResponse): User {
  const u = response.data.user

  return {
    id: u.ID,
    msid: u.MSID,
    email: u.Email,
    name: u.DisplayName,
    roles: response.data.roles ?? [],
    createdAt: u.CreatedAt,
    updatedAt: u.UpdatedAt,
    lastLogin: u.LastLogin,
  }
}

export function useUserApi() {
  const http = useCrudApi()

  // ดึง /api/users/me แล้ว map ให้เป็น User ที่พร้อมใช้ใน FE
  async function getMe(): Promise<User> {
    const resp = await http.getItems(`/users/me`)

    return mapUser(resp as GetUserResponse)
  }

  return { getMe }
}
