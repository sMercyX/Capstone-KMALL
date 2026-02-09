// src/stores/cartStore.ts
import { create } from "zustand"
import type { PaginatedCartData } from "../api/cartApi"

interface CartState {
  cart: PaginatedCartData | null
  isLoading: boolean
  error: string | null

  // actions
  startLoading: () => void
  setCart: (data: PaginatedCartData) => void
  setError: (msg: string | null) => void
  reset: () => void
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  isLoading: false,
  error: null,

  startLoading: () => set({ isLoading: true, error: null }),

  setCart: (data) =>
    set({
      cart: data,
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
      cart: null,
      isLoading: false,
      error: null,
    }),
}))
