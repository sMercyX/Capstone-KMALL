// src/stores/orderStore.ts
import { create } from "zustand"
import type { orderResponse } from "../api/orderApi"

export type OrderTabKey = "ongoing" | "completed" | "canceled"

interface OrderState {
  activeKey: OrderTabKey
  orders: orderResponse[]
  isLoading: boolean
  error: string | null

  setActiveKey: (key: OrderTabKey) => void
  startLoading: () => void
  setOrders: (items: orderResponse[]) => void
  setError: (msg: string | null) => void
  reset: () => void
}

export const useOrderStore = create<OrderState>((set) => ({
  activeKey: null!,
  orders: [],
  isLoading: false,
  error: null,

  setActiveKey: (key) => set({ activeKey: key }),

  startLoading: () => set({ isLoading: true, error: null }),

  setOrders: (items) =>
    set({
      orders: items,
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
    }),
}))
