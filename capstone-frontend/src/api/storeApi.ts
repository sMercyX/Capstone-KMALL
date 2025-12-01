// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type {
  ApiCreateResponse,
  ApiResponse,
  ApiUpdatedResponse,
  PaginatedResponse,
} from "./responseType"

export interface AddResponse {
  id: number
  name: string
  description: string
  profile_url: string
  is_active: "YES" | "NO"
  created_at: string
  updated_at: string
  user_id: string
}

export interface addStoreData {
  name: string
  description: string
  profile_url: string
  is_active: "YES" | "NO"
}

export interface updatedStoreData {
  name?: string
  description?: string
  profile_url?: string
  is_active?: "YES" | "NO"
}

export interface storeProductDataRequset {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  created_at: string
  updated_at: string
  is_active: "YES" | "NO"
  store_id: number
  category_id: string
}

export interface storePictureResponse {
  id: number
  store_id: number
  image_url: string
  sort_order: number
  is_primary: boolean
  created_at: string
  updated_at: string
}
export interface storePictureEditRequest {
  is_primary: boolean
}
export interface storeResponse {
  id: number
  name: string
  description: string
  is_active: "YES" | "NO"
  user_id: string
  profile_url: string
  created_at: string
  updated_at: string
}
export interface storeDeleteResponse {
  deleted: "YES" | "NO"
}
export function useStoreApi() {
  const http = useCrudApi()

  async function addStore(
    data: addStoreData
  ): Promise<ApiCreateResponse<AddResponse>> {
    return http.postItem(`/stores`, data)
  }

  async function getStore(): Promise<ApiResponse<addStoreData>> {
    return http.getItems(`/stores/me`)
  }
  
  async function getStoreDetail(store_id: number): Promise<ApiResponse<storeResponse>> {
    return http.getItems(`/stores/${store_id}/public`)
  }

  async function updateStore(
    store_id: number,
    data: updatedStoreData
  ): Promise<ApiUpdatedResponse<AddResponse>> {
    return http.putItem(`/stores/${store_id}`, data)
  }

  async function getStoreProducts(
    store_id: number,
    pageIndex: number,
    pageSize: number
  ): Promise<PaginatedResponse<storeProductDataRequset>> {
    return http.getItems(
      `/stores/${store_id}/products?page=${pageIndex}&limit=${pageSize}`
    )
  }

  async function getImageStore(
    storeId: number
  ): Promise<ApiResponse<storePictureResponse>> {
    return http.getItems(`/stores/${storeId}/images`)
  }

  async function addImageStore(
    store_id: number,
    file: File
  ): Promise<ApiCreateResponse<storePictureResponse>> {
    const formData = new FormData()
    formData.append("file", file)
    return http.postItem(
      `/stores/${store_id}/images/upload`,
      formData as any
    )
  }

  async function editImageStore(
    image_id: number,
    data: storePictureEditRequest
  ): Promise<ApiUpdatedResponse<storePictureResponse>> {
    return http.putItem(`/store-images/${image_id}`, data)
  }

  async function deleteStore(store_id: number): Promise<ApiResponse<storeDeleteResponse>> {
    return http.deleteItem(`/stores/${store_id}`)
  }

  return {
    addStore,
    getStore,
    updateStore,
    getStoreProducts,
    getImageStore,
    addImageStore,
    editImageStore,
    getStoreDetail,
    deleteStore,
  }
}
