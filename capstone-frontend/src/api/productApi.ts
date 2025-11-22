// api/productApi.ts
import { useCrudApi } from "../utils/fetch"
import type { PaginatedResponse } from "./responseType"

export type CategoryType = "food" | "clothing" | "handmade-products"

export interface Product {
  id: number
  name: string
  slug: string
  is_active: "YES" | "NO"
  created_at: string
  updated_at: string

  // FE-only fields
  image?: string
  price?: number
  rating?: number
  ratingCount?: number
  shop?: string
  badge?: string
  category?: string
}

export type ProductListResponse = PaginatedResponse<Product>

export function useProductApi() {
  const http = useCrudApi()

  async function getProductsByCategory(
    category: CategoryType,
    pageIndex: number,
    limit: number,
    categoryId: number
  ): Promise<ProductListResponse> {
    const q = encodeURIComponent(category)

    return http.getItems(
      `/api/products/public?q=${q}&category_id=${categoryId}&page=${pageIndex}&limit=${limit}`
    )
  }

  async function getProductBySlug(slug: string) {
    return http.getItems(`/api/products/public/${slug}`)
  }

  async function getProductsByStore(storeId: number) {
    return http.getItems(`/api/products/public?store_id=${storeId}`)
  }

  return { getProductsByCategory, getProductBySlug, getProductsByStore }
}
