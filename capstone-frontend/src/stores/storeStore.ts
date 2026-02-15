// src/stores/storeStore.ts
import { create } from "zustand"
import { useStoreApi } from "../api/storeApi"

export interface StoreData {
  id: number
  name: string
  description: string
  profile_url: string
  is_active: "YES" | "NO"
  created_at?: string
  updated_at?: string
  user_id?: string
}

interface StoreState {
  store: StoreData | null
  loading: boolean
  error: string | null

  fetchStore: () => Promise<void>
  updateStoreData: (data: Partial<StoreData>) => void
  clearStore: () => void
}

// ใช้ pattern เดียวกับ userStore
const { getStore } = useStoreApi()

export const useStoreStore = create<StoreState>((set) => ({
  store: null,
  loading: false,
  error: null,

  // ดึงข้อมูลร้านของตัวเองจาก /api/stores/me
  fetchStore: async () => {
    set({ loading: true, error: null })

    try {
      const res = await getStore()
      // สมมติ response = { code, data, status }
      const data = (res as any).data as StoreData | undefined
      set({
        store: data ?? null,
        loading: false,
        error: data ? null : "Store information not found.",
      })
    } catch (err) {
      console.error("fetch store failed:", err)
      set({
        store: null,
        loading: false,
        error: "Unable to load store information.",
      })
    }
  },

  // แก้ค่าใน store ฝั่ง FE หลังอัปเดตสำเร็จ
  updateStoreData: (data) =>
    set((state) => ({
      store: state.store ? { ...state.store, ...data } : null,
    })),

  clearStore: () => set({ store: null, loading: false, error: null }),
}))
