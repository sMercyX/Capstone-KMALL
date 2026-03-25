// src/api/addressApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse, ApiCreateResponse, ApiUpdatedResponse } from "./responseType"

export interface UserAddress {
  id: number
  user_id: string
  address_line1: string
  address_line2: string
  district: string
  province: string
  postal_code: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useAddressApi() {
  const http = useCrudApi()

  async function getAddresses(): Promise<ApiResponse<UserAddress[]>> {
    return http.getItems("/addresses") as Promise<ApiResponse<UserAddress[]>>
  }

  async function createAddress(data: Omit<UserAddress, "id" | "user_id" | "is_default" | "is_active" | "created_at" | "updated_at">): Promise<ApiCreateResponse<UserAddress>> {
    return http.postItem("/addresses", data) as Promise<ApiCreateResponse<UserAddress>>
  }

  async function updateAddress(id: number, data: Partial<UserAddress>): Promise<ApiUpdatedResponse<UserAddress>> {
    return http.putItem(`/addresses/${id}`, data) as Promise<ApiUpdatedResponse<UserAddress>>
  }

  async function deleteAddress(id: number): Promise<void> {
    return http.deleteItem(`/addresses/${id}`) as Promise<void>
  }


  return {
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
  }
}
