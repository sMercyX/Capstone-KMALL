// src/stores/categoriesStore.ts
import { create } from "zustand";
import { useProductApi } from "../api/productApi";
import type { ProductCategory } from "../api/productApi";

interface CategoriesState {
  categories: ProductCategory[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: string | null; // เช่น "food", "clothing"

  setSelectedCategory: (slug: string | null) => void;
  fetchCategories: (type: string, pageIndex?: number, limit?: number) => Promise<void>;
  clear: () => void;
}

export const useCategoriesStore = create<CategoriesState>((set) => {
  // ❗ ใช้ useProductApi() ข้างใน store ไม่ได้ ต้องประกาศภายนอก
  const productApi = useProductApi();

  return {
    categories: [],
    isLoading: false,
    error: null,
    selectedCategory: null,

    setSelectedCategory: (slug) => set({ selectedCategory: slug }),

    fetchCategories: async (
      type: string,
      pageIndex = 1,
      limit = 20
    ) => {
      set({ isLoading: true, error: null });

      try {
        const resp = await productApi.getProductCategories(
          type as any,
          pageIndex,
          limit
        );

        set({
          categories: resp.data,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("fetchCategories error:", err);

        set({
          isLoading: false,
          error: err?.message ?? "Failed to load categories",
        });
      }
    },

    clear: () =>
      set({
        categories: [],
        selectedCategory: null,
        isLoading: false,
        error: null,
      }),
  };
});
