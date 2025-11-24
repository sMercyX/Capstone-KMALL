// src/api/userApi.ts
import { useCrudApi } from "../utils/fetch"
import type {
  ApiCreateResponse,
  ApiResponse,
  ApiUpdatedResponse,
} from "./responseType"

// ------------- FE-friendly User -------------
// export interface storeData {
//   id: string;
//   msid: string;
//   email: string;
//   name: string;
//   roles: string[];
//   createdAt: string;
//   updatedAt: string;
//   lastLogin: string;
// }

// export type GetUserResponse = ApiResponse<storeData>;

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
export interface getStoreProductData {
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
    return http.postItem(`/api/stores`, data)
  }

  async function getStore(): Promise<ApiResponse<addStoreData>> {
    return http.getItems(`/api/stores/me`)
  }

  async function updateStore(
    store_id: number,
    data: updatedStoreData
  ): Promise<ApiUpdatedResponse<AddResponse>> {
    return http.putItem(`/api/stores/${store_id}`, data)
  }

  async function getStoreProducts(
    store_id: number
  ): Promise<ApiResponse<getStoreProductData>> {
    return http.getItems(`/api/stores/${store_id}/products`)
  }

  return { addStore, getStore, updateStore, getStoreProducts }
}
