// src/pages/Store/StoreProductsTab/storeProductStore.ts
import { create } from "zustand"
import type { storeProductDataRequset } from "../../../api/storeApi"
import type { PaginatedResponse } from "../../../api/responseType"

type PaginatedData<T> = PaginatedResponse<T>["data"]

interface StoreProductState {
  items: storeProductDataRequset[]
  pageIndex: number
  pageSize: number
  total: number

  isLoading: boolean
  error: string | null

  setPageIndex: (page: number) => void
  startLoading: () => void
  setPageData: (data: PaginatedData<storeProductDataRequset>) => void
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

  setPageData: (data) =>
    set({
      items: data.items ?? [],
      pageIndex: data.pageIndex ?? 1,
      pageSize: data.pageSize ?? 5,
      total: data.total ?? 0,
      isLoading: false,
      error: null,
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
