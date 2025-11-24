// src/pages/Store/StoreProductsTab/storeProductStore.ts
import { create } from "zustand"
import type { storeProductDataRequset } from "../../../api/storeApi"

interface StoreProductState {
  items: storeProductDataRequset[]
  pageIndex: number
  pageSize: number
  total: number

  isLoading: boolean
  error: string | null

  setPageIndex: (page: number) => void
  startLoading: () => void
  // รับ data ได้ทั้งแบบ array เฉย ๆ หรือแบบ { items, pageIndex, pageSize, total }
  setPageData: (data: any) => void
  setError: (msg: string | null) => void
  reset: () => void
}

export const useStoreProductStore = create<StoreProductState>((set) => ({
  items: [],
  pageIndex: 1,
  pageSize: 5,
  total: 0,

  isLoading: false,
  error: null,

  setPageIndex: (page) => set({ pageIndex: page }),

  startLoading: () =>
    set({
      isLoading: true,
      error: null,
    }),

  setPageData: (data: any) =>
    set(() => {
      const raw = data as any

      // กรณี 1: BE ส่งแบบ { items: [...], pageIndex, pageSize, total }
      // กรณี 2: BE ส่งแบบ [...products] เฉย ๆ
      const items: storeProductDataRequset[] = Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw)
        ? raw
        : []

      const total =
        typeof raw.total === "number"
          ? raw.total
          : Array.isArray(items)
          ? items.length
          : 0

      const pageIndex = typeof raw.pageIndex === "number" ? raw.pageIndex : 1
      const pageSize = typeof raw.pageSize === "number" ? raw.pageSize : 5

      return {
        items,
        pageIndex,
        pageSize,
        total,
        isLoading: false,
        error: null,
      }
    }),

  setError: (msg) =>
    set({
      isLoading: false,
      error: msg,
    }),

  reset: () =>
    set({
      items: [],
      pageIndex: 1,
      pageSize: 5,
      total: 0,
      isLoading: false,
      error: null,
    }),
}))
