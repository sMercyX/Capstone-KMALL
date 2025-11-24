// api/productApi.ts
import { useCrudApi } from "../utils/fetch";
import type { ApiResponse } from "./responseType";

export type CategoryType = "food" | "clothing" | "handmade-products";

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: "YES" | "NO";
  created_at: string;
  updated_at: string;
}

// backend ส่ง array กลับมา
export type ProductCategoriesResponse = ApiResponse<ProductCategory[]>;

export function useProductApi() {
  const http = useCrudApi();

  async function getProductCategories(
    type: CategoryType,
    pageIndex: number,
    limit: number
  ): Promise<ProductCategoriesResponse> {
    return http.getItems(
      `/api/categories?q=${type}&page=${pageIndex}&limit=${limit}`
    );
  }

  return { getProductCategories };
}
