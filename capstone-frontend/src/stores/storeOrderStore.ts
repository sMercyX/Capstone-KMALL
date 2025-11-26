// src/stores/storeOrderStore.ts
import { create } from "zustand";
import type { orderSellerResponse } from "../api/orderSellerApi";

export type StoreOrderTabKey = "ongoing" | "completed" | "canceled";

interface StoreOrderState {
  activeKey: StoreOrderTabKey;
  orders: orderSellerResponse[];
  isLoading: boolean;
  error: string | null;

  setActiveKey: (key: StoreOrderTabKey) => void;
  startLoading: () => void;
  setOrders: (items: orderSellerResponse[]) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useStoreOrderStore = create<StoreOrderState>((set) => ({
  activeKey: "ongoing",
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
}));
