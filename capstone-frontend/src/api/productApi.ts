// api/productApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiCreateResponse, ApiUpdatedResponse, PaginatedResponse, ApiResponse } from "./responseType"

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
  store_name: string
  category_id: number
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

export interface productPictureResponse {
  id: number
  product_id: number
  image_url: string
  sort_order: number
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface productPictureEditRequest {
  is_primary: boolean
}

export interface EditProductRequest {
  name: string
  description: string
  price: number
  image_url: string
  is_active: "YES" | "NO"
  category_id: number
}


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

  async function getProductsByParentId(
    categoryId: number,
    limit: number,
    pageIndex: number
  ): Promise<CategoryListResponse> {
    return http.getItems(
      `/api/products/public?parent_category_id=${categoryId}&limit=${limit}&page=${pageIndex}`
    )
  }
  async function getProductsStoreByStoreId(
    storeId: number,
    limit: number,
    pageIndex: number
  ): Promise<CategoryListResponse> {
    return http.getItems(
      `/api/products/public?store_id=${storeId}&limit=${limit}&page=${pageIndex}`
    )
  }

  async function addProduct(
    data: AddProductRequest
  ): Promise<ApiCreateResponse<Product>> {
    return http.postItem(`/api/products`, data)
  }

  async function getProduct(store_id: number) {
    return http.getItems(`/api/products/${store_id}/public`)
  }
  
  async function editProduct(
    product_id: number,
    data: EditProductRequest
  ): Promise<ApiUpdatedResponse<Product>> {
    return http.putItem(`/api/products/${product_id}`, data)
  }
  
  async function deleteProduct(product_id: number) {
    return http.deleteItem(`/api/products/${product_id}`)
  }

  async function addImageProduct(
    product_id: number,
    files: File[]
  ): Promise<ApiCreateResponse<productPictureResponse[]>> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append("file", file)
    })
    return http.postItem(
      `/api/products/${product_id}/images/upload`,
      formData 
    )
  }

  async function editImageProduct(
    image_id: number,
    data: productPictureEditRequest
  ): Promise<ApiUpdatedResponse<productPictureResponse>> {
    return http.putItem(`/api/product-images/${image_id}`, data)
  }

  async function getProductImage(
    productId: number
  ): Promise<ApiResponse<productPictureResponse[]>> {
    return http.getItems(`/api/products/${productId}/images`)
  }

  async function deleteProductImage(
    imageId: number
  ): Promise<ApiResponse<any>> {
    return http.deleteItem(`/api/product-images/${imageId}`)
  }
  

  return {
    getProductsByCategory,
    getProductBySlug,
    getProductsByStore,
    getProductsByParentId,
    getProductsStoreByStoreId,
    addProduct,
    getProduct,
    editProduct,
    deleteProduct,
    addImageProduct,
    editImageProduct,
    getProductImage,
    deleteProductImage,
  }
}
