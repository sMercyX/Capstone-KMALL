// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

export interface CatagoriesResponse {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: "YES" | "NO"
  created_at: string
  updated_at: string
}

export function useCatagoriesApi() {
  const http = useCrudApi()

  async function getCatagoriesName(
    parent_id: number
  ): Promise<ApiResponse<CatagoriesResponse[]>> {
    return http.getItems(`/api/categories?parent_id=${parent_id}`)
  }

  async function getCatagoriesSubName(): Promise<
    ApiResponse<CatagoriesResponse[]>
  > {
    return http.getItems(`/api/categories?only_sub=true`)
  }

  async function getCatagoriesDetail(
    id: number
  ): Promise<ApiResponse<CatagoriesResponse>> {
    return http.getItems(`/api/categories/${id}/public`)
  }

  return { getCatagoriesName, getCatagoriesSubName, getCatagoriesDetail }
}
