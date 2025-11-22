// stores/productStore.ts
import { create } from "zustand";
import type { Product } from "../api/productApi";

interface ProductStoreState {
  product: Product | null;
  related: Product[];
  isLoading: boolean;
  error: string | null;

  startLoading: () => void;
  setProduct: (p: Product | null) => void;
  setRelated: (items: Product[]) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useProductStore = create<ProductStoreState>((set) => ({
  product: null,
  related: [],
  isLoading: false,
  error: null,

  startLoading: () =>
    set({
      isLoading: true,
      error: null,
    }),

  setProduct: (p) =>
    set({
      product: p,
      isLoading: false,
      error: null,
    }),

  setRelated: (items) =>
    set({
      related: items,
    }),

  setError: (msg) =>
    set({
      error: msg,
      isLoading: false,
    }),

  reset: () =>
    set({
      product: null,
      related: [],
      isLoading: false,
      error: null,
    }),
}));
