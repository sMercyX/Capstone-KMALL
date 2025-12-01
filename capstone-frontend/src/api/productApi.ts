// api/productApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiCreateResponse, PaginatedResponse } from "./responseType"

export type CategoryType = "food" | "clothing" | "handmade-products"

// export interface Product {
//   id: number
//   name: string
//   slug: string
//   is_active: "YES" | "NO"
//   created_at: string
//   updated_at: string

//   // FE-only fields
//   image?: string
//   price?: number
//   rating?: number
//   ratingCount?: number
//   shop?: string
//   badge?: string
//   category?: string
// }
export interface ProductImage {
  product_image_id: number
  image_url: string
  sort_order: number
  is_primary: boolean
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  created_at: string
  updated_at: string
  is_active: "YES" | "NO"
  store_id: number
  category_id: number

  images?: ProductImage[]
}
export interface AddProductRequest {
  name: string
  description: string
  price: number
  image_url: string
  is_active: "YES" | "NO"
  store_id: number
  category_id: number
}

export type ProductListResponse = PaginatedResponse<Product>

export type CategoryListResponse = PaginatedResponse<Product>

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
      `/products/public?q=${q}&category_id=${categoryId}&page=${pageIndex}&limit=${limit}`
    )
  }

  async function getProductBySlug(slug: string) {
    return http.getItems(`/products/public/${slug}`)
  }

  async function getProductsByStore(storeId: number) {
    return http.getItems(`/products/public?store_id=${storeId}`)
  }
  
  async function getProductsByParentId(
    categoryId: number,
    limit: number,
    pageIndex: number
  ): Promise<CategoryListResponse> {
    return http.getItems(
      `/products/public?parent_category_id=${categoryId}&limit=${limit}&page=${pageIndex}`
    )
  }
  
  async function addProduct(
    data: AddProductRequest
  ): Promise<ApiCreateResponse<Product>> {
    return http.postItem(`/products`, data)
  }

  async function getProduct(storeId: number) {
    return http.getItems(`/products/${storeId}/public`)
  }


  return {
    getProductsByCategory,
    getProductBySlug,
    getProductsByStore,
    getProductsByParentId,
    addProduct,
    getProduct
  }
}
