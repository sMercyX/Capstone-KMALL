import { create } from "zustand"
import type { orderResponse, PaginatedOrderResponse } from "../api/orderApi"

export type OrderTabKey = "ongoing" | "completed" | "canceled"

interface OrderState {
  activeKey: OrderTabKey
  orders: orderResponse[]
  isLoading: boolean
  error: string | null

  page: number
  totalPages: number
  totalItems: number

  setActiveKey: (key: OrderTabKey) => void
  setPage: (page: number) => void
  startLoading: () => void
  setOrders: (data: PaginatedOrderResponse) => void
  setError: (msg: string | null) => void
  reset: () => void
}

export const useOrderStore = create<OrderState>((set) => ({
  activeKey: "ongoing",
  orders: [],
  isLoading: false,
  error: null,
  page: 1,
  totalPages: 1,
  totalItems: 0,

  setActiveKey: (key) => set((state) => ({ 
    activeKey: key, 
    page: state.activeKey === key ? state.page : 1 
  })),

  setPage: (page) => set({ page }),

  startLoading: () => set({ isLoading: true, error: null }),

  setOrders: (data) =>
    set({
      orders: data.items || [],
      page: data.page_index || 1,
      totalPages: Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 10))),
      totalItems: data.total || 0,
      isLoading: false,
      error: null,
    }),

  setError: (msg) =>
    set({
      error: msg,
      isLoading: false,
    }),

  reset: () =>
    set({
      activeKey: "ongoing",
      orders: [],
      isLoading: false,
      error: null,
      page: 1,
      totalPages: 1,
      totalItems: 0,
    }),
}))
