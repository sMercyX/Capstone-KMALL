// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

export interface CatagoriesResponse {
  id: number
  name: string
  slug: string
  parent_id?: number | null
  sort_order: number
  is_active: "YES" | "NO"
  icon_url?: string | null
  created_at: string
  updated_at: string
  product_count?: number
  active_product_count?: number
  inactive_product_count?: number
}

export function useCatagoriesApi() {
  const http = useCrudApi()

  async function getCatagoriesName(
    parent_id: number
  ): Promise<ApiResponse<CatagoriesResponse[]>> {
    return http.getItems(`/categories?parent_id=${parent_id}`)
  }

  async function getAdminCategories(params?: {
    is_active?: string
    parent_id?: string | number | null
    q?: string
    limit?: number
  }): Promise<ApiResponse<CatagoriesResponse[]>> {
    let url = "/admin/categories"
    const query = new URLSearchParams()
    if (params?.is_active) query.append("is_active", params.is_active)
    if (params?.parent_id !== undefined) {
      if (params.parent_id === null) query.append("parent_id", "null")
      else query.append("parent_id", String(params.parent_id))
    }
    if (params?.q) query.append("q", params.q)
    if (params?.limit) query.append("limit", String(params.limit))
    
    const qs = query.toString()
    if (qs) url += `?${qs}`

    return http.getItems(url)
  }

  async function getCatagoriesSubName(): Promise<
    ApiResponse<CatagoriesResponse[]>
  > {
    return http.getItems(`/categories?only_sub=true`)
  }

  async function getCatagoriesDetail(
    id: number
  ): Promise<ApiResponse<CatagoriesResponse>> {
    return http.getItems(`/categories/${id}/public`)
  }

  async function uploadCategoryIcon(file: File): Promise<ApiResponse<{ icon_url: string }>> {
    const formData = new FormData()
    formData.append("file", file)
    return http.postItem("/admin/categories/upload-icon", formData) as Promise<ApiResponse<{ icon_url: string }>>
  }

  async function addCategory(payload: any): Promise<ApiResponse<any>> {
    return http.postItem("/admin/categories", payload)
  }

  async function updateCategory(id: number, payload: { name: string; icon_url: string }): Promise<ApiResponse<any>> {
    return http.putItem(`/admin/categories/${id}`, payload)
  }

  async function deleteCategory(id: number, moveToSubCategoryId?: number): Promise<ApiResponse<any>> {
    let url = `/admin/categories/${id}`
    if (moveToSubCategoryId) {
      url += `?move_to_sub_category_id=${moveToSubCategoryId}`
    }
    return http.deleteItem(url)
  }

  return { getCatagoriesName, getCatagoriesSubName, getAdminCategories, getCatagoriesDetail, uploadCategoryIcon, addCategory, updateCategory, deleteCategory }
}
