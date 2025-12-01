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

  return { addStore, getStore, updateStore, getStoreProducts }
}
