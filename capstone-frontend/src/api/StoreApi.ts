// src/api/userApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiCreateResponse } from "./responseType"

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

export type addStoreResponse = ApiCreateResponse<AddResponse>

export interface addStoreData {
  name: string
  description: string
  profile_url: string
  is_active: "YES" | "NO"
}

export function useUserApi() {
  const http = useCrudApi()

  async function addStore(data: addStoreData): Promise<addStoreResponse> {
    return http.postItem(`/api/stores`, data)
  }

  return { addStore }
}
