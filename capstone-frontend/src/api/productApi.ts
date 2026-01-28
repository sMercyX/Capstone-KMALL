// src/api/productApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiCreateResponse, ApiUpdatedResponse, PaginatedResponse, ApiResponse } from "./responseType"

export type CategoryType = "food" | "clothing" | "handmade-products"

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
    categoryId: number,
    price: string
  ): Promise<ProductListResponse> {
    const q = encodeURIComponent(category)

    return http.getItems(
      `/products/public?q=${q}&category_id=${categoryId}&page=${pageIndex}&limit=${limit}&price=${price}  `
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
    pageIndex: number,
    sortBy?: string,
    categoryIds?: number[],
    minPrice?: number,
    maxPrice?: number
  ): Promise<CategoryListResponse> {
    let url = `/products/public?parent_category_id=${categoryId}&limit=${limit}&page=${pageIndex}`
    if (sortBy) {
      url += `&sort_by=${sortBy}`
    }
    if (categoryIds && categoryIds.length > 0) {
      categoryIds.forEach((id) => {
        url += `&category_id=${id}`
      })
    }
    if (minPrice !== undefined) {
      url += `&min_price=${minPrice}`
    }
    if (maxPrice !== undefined) {
      url += `&max_price=${maxPrice}`
    }
    return http.getItems(url)
  }
  
  interface SearchProductsParams {
    q: string
    limit: number
    page: number
    sortBy?: string
    categoryIds?: number[]
    parentCategoryId?: number
    minPrice?: number
    maxPrice?: number
    fulfillment?: string
    storeId?: number
  }

  async function searchProducts(params: SearchProductsParams): Promise<ProductListResponse> {
    const { q, limit, page, sortBy, categoryIds, parentCategoryId, minPrice, maxPrice, fulfillment, storeId } = params
    
    let url = `/products/public?q=${encodeURIComponent(q)}&limit=${limit}&page=${page}`
    
    if (sortBy) url += `&sort_by=${sortBy}`
    if (parentCategoryId) url += `&parent_category_id=${parentCategoryId}`
    if (minPrice !== undefined) url += `&min_price=${minPrice}`
    if (maxPrice !== undefined) url += `&max_price=${maxPrice}`
    if (fulfillment) url += `&fulfillment=${fulfillment}`
    if (storeId) url += `&store_id=${storeId}`
    if (categoryIds && categoryIds.length > 0) {
      categoryIds.forEach((id) => {
        url += `&category_id=${id}`
      })
    }
    
    return http.getItems(url)
  }

  async function getProductsStoreByStoreId(
    storeId: number,
    limit: number,
    pageIndex: number
  ): Promise<CategoryListResponse> {
    return http.getItems(
      `/products/public?store_id=${storeId}&limit=${limit}&page=${pageIndex}`
    )
  }

  async function addProduct(
    data: AddProductRequest
  ): Promise<ApiCreateResponse<Product>> {
    return http.postItem(`/products`, data)
  }

  async function getProduct(store_id: number) {
    return http.getItems(`/products/${store_id}/public`)
  }
  
  async function editProduct(
    product_id: number,
    data: EditProductRequest
  ): Promise<ApiUpdatedResponse<Product>> {
    return http.putItem(`/products/${product_id}`, data)
  }
  
  async function deleteProduct(product_id: number) {
    return http.deleteItem(`/products/${product_id}`)
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
      `/products/${product_id}/images/upload`,
      formData 
    )
  }

  async function editImageProduct(
    image_id: number,
    data: productPictureEditRequest
  ): Promise<ApiUpdatedResponse<productPictureResponse>> {
    return http.putItem(`/product-images/${image_id}`, data)
  }

  async function getProductImage(
    productId: number
  ): Promise<ApiResponse<productPictureResponse[]>> {
    return http.getItems(`/products/${productId}/images`)
  }

  async function deleteProductImage(
    imageId: number
  ): Promise<ApiResponse<any>> {
    return http.deleteItem(`/product-images/${imageId}`)
  }
  

  return {
    getProductsByCategory,
    getProductBySlug,
    getProductsByStore,
    getProductsByParentId,
    searchProducts, // Add searchProducts here
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
