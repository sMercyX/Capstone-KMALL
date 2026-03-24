// src/api/blacklistApi.ts
import { useCrudApi } from "../utils/fetch"

export interface BlacklistItem {
  blacklist_id: number
  user_id: string
  user_role: "SELLER" | "BUYER"
  report_id: number
  order_id: number
  reason: string
  ban_type: "WARNING" | "TEMPORARY" | "PERMANENT"
  banned_from: string
  banned_until?: string
  is_active: boolean
  created_by: string
  created_at: string
  display_name: string
  store_id?: number
  store_name?: string
}

export interface PaginatedBlacklist {
  page_size: number
  page_index: number
  total: number
  items: BlacklistItem[]
}

export function useBlacklistApi() {
  const http = useCrudApi()

  async function getBlacklist(params: {
    user_role: "SELLER" | "BUYER"
    is_active?: boolean
    ban_type?: "WARNING" | "TEMPORARY" | "PERMANENT"
    limit?: number
    page?: number
    q?: string
  }): Promise<{ code: number; data: PaginatedBlacklist; status: string }> {
    const qp = new URLSearchParams()
    qp.append("user_role", params.user_role)
    if (params.is_active !== undefined) qp.append("is_active", String(params.is_active))
    if (params.ban_type) qp.append("ban_type", params.ban_type)
    if (params.limit) qp.append("limit", params.limit.toString())
    if (params.page) qp.append("page", params.page.toString())
    if (params.q) qp.append("q", params.q)

    return http.getItems(`/admin/user-blacklists?${qp.toString()}`)
  }

  async function revokeBlacklist(userId: string, blacklistId: number): Promise<{ code: number; data: BlacklistItem; status: string }> {
    return http.patchItem(`/admin/users/${userId}/ban/${blacklistId}/revoke`)
  }

  return { getBlacklist, revokeBlacklist }
}
