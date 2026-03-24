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
  category_name: string
  sold_count?: number
  product_type: "STOCK" | "PREORDER"
  options?: OptionKey[]
  variants?: Variant[]
}

export interface OptionKey {
  id: number
  product_id: number
  key_name: string
  sort_order: number
  is_image_key: boolean
  values: OptionValue[]
}

export interface OptionValue {
  id: number
  option_key_id: number
  value_label: string
  sort_order: number
  image_url?: string
}

export interface Variant {
  id: number
  product_id: number
  sku?: string
  price_delta: number
  final_price: number
  stock_qty: number
  is_active: boolean
  selections: {
    key: string
    value: string
  }[]
}

export interface AddProductRequest {
  name: string
  description: string
  price: number
  product_type: string
  image_url: string
  is_active: "YES" | "NO"
  store_id: number
  category_id: number
  options?: {
    key_name: string
    sort_order: number
    is_image_key?: boolean
    values: {
      value_label: string
      sort_order: number
    }[]
  }[]
  variants?: {
    option_value_labels: string[]
    price_delta: number
    stock_qty: number
    is_active: boolean
  }[]
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

export interface BulkUploadResponse {
  option_value_images: OptionValue[]
  product_images: productPictureResponse[]
}

export interface EditProductRequest {
  name?: string
  description?: string
  price?: number
  image_url?: string
  is_active?: "YES" | "NO"
  category_id?: number
  product_type?: string
}

export interface EditVariantsConfigReq {
  options: {
    key_name: string
    sort_order: number
    values: {
      value_label: string
      sort_order: number
    }[]
    is_image_key?: boolean
  }[]
  variants: {
    option_value_labels: string[]
    price_delta: number
    stock_qty: number
    is_active?: boolean
  }[]
}

// Recommendation API types
export interface RecommendationProduct {
  product: {
    id: number
    name: string
    description: string
    price: number
    image_url: string
    is_active: string
    store_id: number
    store_name: string
    category_id: number
    category_name: string
    sold_count: number
  }
  score?: number
  rank_no?: number
  reason?: string
  quantity?: number
  unit_price?: number
  subtotal?: number
}

export interface CancellationRecommendationResponse {
  order_id: number
  context: string
  cancelled_items: RecommendationProduct[]
  items: RecommendationProduct[]
  source: string
  event_id: number
  created_at: string
  generated_at: string
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

  async function getProductById(id: number): Promise<ApiResponse<Product>> {
    return http.getItems(`/products/${id}`)
  }
  
  async function editProduct(
    product_id: number,
    data: EditProductRequest
  ): Promise<ApiUpdatedResponse<Product>> {
    return http.putItem(`/products/${product_id}`, data)
  }

  async function editProductVariantsConfig(
    product_id: number,
    data: EditVariantsConfigReq
  ): Promise<ApiUpdatedResponse<Product>> {
    return http.putItem(`/products/${product_id}/variants-config`, data)
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

  async function getCancellationRecommendations(
    orderId: number,
    limit: number = 12
  ): Promise<ApiResponse<CancellationRecommendationResponse>> {
    return http.getItems(`/recommendation/orders/${orderId}?context=cancellation&limit=${limit}`)
  }

  async function bulkUploadProductImages(
    product_id: number,
    files: File[],
    optionValueImages: { optionName: string; valueLabel: string; file: File }[]
  ): Promise<ApiCreateResponse<BulkUploadResponse>> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append("images", file)
    })
    optionValueImages.forEach((item) => {
      formData.append(`option_value_image[${item.optionName}:${item.valueLabel}]`, item.file)
    })
    return http.postItem(
      `/products/${product_id}/images/bulk-upload`,
      formData
    )
  }

  async function deleteOptionValueImage(productId: number, keyId: number, valueId: number): Promise<ApiResponse<any>> {
    return http.deleteItem(`/products/${productId}/options/${keyId}/values/${valueId}/image`)
  }

  return {
    getProductsByCategory,
    getProductBySlug,
    getProductsByStore,
    getProductsByParentId,
    searchProducts,
    getProductsStoreByStoreId,
    addProduct,
    getProduct,
    getProductById,
    editProduct,
    editProductVariantsConfig,
    deleteProduct,
    addImageProduct,
    editImageProduct,
    getProductImage,
    deleteProductImage,
    getCancellationRecommendations,
    bulkUploadProductImages,
    deleteOptionValueImage,
  }
}
