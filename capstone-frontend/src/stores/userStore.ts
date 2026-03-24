// src/stores/userStore.ts
import { create } from "zustand"
import { useUserApi, type User as ApiUser } from "../api/userApi"

interface UserState {
  id: string
  name: string
  email: string
  roles: string[]        // เก็บทุก role เช่น ["buyer", "seller"]
  bans: any[]           // เก็บรายการโดนแบน
  isLoading: boolean

  setUser: (user: Partial<UserState>) => void
  setRoles: (roles: string[]) => void
  addRole: (role: string) => void

  fetchUser: () => Promise<void>
  clearUser: () => void
}

// ใช้ getMe จาก userApi (โค้ดคุณมีอยู่แล้ว)
const { getMe } = useUserApi()

export const useUserStore = create<UserState>((set) => ({
  id: "",
  name: "",
  email: "",
  roles: [],
  bans: [],
  isLoading: false,

  // เซ็ตทีละก้อน (ใช้เวลาดึงจาก AuthContext หรือหน้าอื่น)
  setUser: (user) =>
    set((state) => ({
      ...state,
      ...user,
    })),

  // เซ็ต roles ทั้ง array
  setRoles: (roles) => set({ roles }),

  // เพิ่ม role ใหม่เข้า roles ถ้ายังไม่มี (ไม่ให้ซ้ำ)
  addRole: (role) =>
    set((state) => {
      const lower = role.toLowerCase()
      const exists = state.roles.some((r) => r.toLowerCase() === lower)

      if (exists) return state

      return {
        ...state,
        roles: [...state.roles, lower],
      }
    }),

  // ดึง /api/users/me → map ลง store
  fetchUser: async () => {
    set({ isLoading: true })
    try {
      const data: ApiUser = await getMe()

      set({
        id: data.id,
        name: data.name,
        email: data.email,
        roles: data.roles ?? [],
        bans: data.bans ?? [],
        isLoading: false,
      })
    } catch (err) {
      console.error("fetchUser failed:", err)
      set({ isLoading: false })
    }
  },

  // เคลียร์ข้อมูล user ทั้งหมด
  clearUser: () =>
    set({
      id: "",
      name: "",
      email: "",
      roles: [],
      bans: [],
      isLoading: false,
    }),
}))
