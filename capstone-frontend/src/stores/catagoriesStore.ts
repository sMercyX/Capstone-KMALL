import { create } from "zustand"
import type { PaginatedData } from "../api/responseType"
import type { Product } from "../api/productApi"

interface ProductListState {
  items: Product[]
  pageIndex: number
  pageSize: number
  total: number

  isLoading: boolean
  error: string | null

  setPageIndex: (page: number) => void
  startLoading: () => void
  setPageData: (data: PaginatedData<Product>) => void
  setError: (msg: string | null) => void
  reset: () => void
}

export const useProductListStore = create<ProductListState>((set) => ({
  items: [],
  pageIndex: 1,
  pageSize: 12,
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
      items: Array.isArray((data as any).items)
        ? (data as any).items
        : Array.isArray((data as any).data)
        ? (data as any).data
        : [],
      pageIndex: data.pageIndex ?? 1,
      pageSize: data.pageSize ?? 12,
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
      pageSize: 12,
      total: 0,
      isLoading: false,
      error: null,
    }),
}))
