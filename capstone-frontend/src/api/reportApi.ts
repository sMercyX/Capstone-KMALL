// src/api/reportApi.ts
import { useCrudApi } from "../utils/fetch"

export interface ReportResponse {
  report_id: number
  order_id: number
  reporter_id: string
  reported_user_id: string
  reported_party_type: "SELLER" | "BUYER"
  reason_code: string
  description: string
  status: string
  created_at: string
  updated_at: string
}

export interface PaginatedReports {
  page_size: number
  page_index: number
  total: number
  items: ReportResponse[]
}

export interface MyReportAdminAction {
  action_id: number
  report_id: number
  admin_id: string
  action_type: string
  note?: string | null
  target_user_id?: string | null
  suspend_days?: number | null
  is_permanent?: boolean
  created_at: string
  blacklist?: {
    blacklist_id: number
    user_id: string
    user_role: string
    report_id: number
    order_id: number
    reason: string
    ban_type: string
    banned_from: string
    banned_until: string
    is_active: boolean
    created_by: string
    created_at: string
    display_name: string
  } | null
}

export interface MyReportDetailResponse {
  report_id: number
  created_at: string
  order_id: number
  store_name: string
  reported_user_id: string
  reported_display_name: string
  reported_party_type: "SELLER" | "BUYER"
  reason_code: string
  status: string
  admin_actions: MyReportAdminAction[] | null
}

export interface ReportDetailResponse {
  report: ReportDetail
  order_snapshot: OrderSnapshot
  chat_snapshots: ChatSnapshot[]
  evidences: Evidence[]
  admin_actions: any | null // adjust type later if needed
}

export interface ReportDetail {
  report_id: number
  order_id: number
  store_id: number
  store_name: string
  reporter_id: string
  reporter_display_name: string
  reported_user_id: string
  reported_display_name: string
  reported_party_type: "SELLER" | "BUYER"
  reason_code: string
  description: string
  status: string
  created_at: string
  updated_at: string
}

export interface OrderSnapshot {
  report_id: number
  order_status: string
  total_price: number
  order_date: string
  delivery_method: string
  items: OrderSnapshotItem[]
  created_at: string
}

export interface OrderSnapshotItem {
  order_id: number
  quantity: number
  subtotal: number
  product_id: number
  unit_price: number
  product_name: string
  order_item_id: number
  deposit_amount: number
  fulfillment_type: string
  product_image_url: string
  store_profile_url: string
  promised_ship_date: string
}

export interface ChatSnapshot {
  snapshot_id: number
  report_id: number
  sender_id: string
  sender_role: "BUYER" | "SELLER"
  message_text: string
  message_type: string
  attachment_urls: string[] | null
  message_created_at: string
}

export interface Evidence {
  evidence_id: number
  report_id: number
  uploaded_by: string
  file_url: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export function useReportApi() {
  const http = useCrudApi()

  async function createOrderReport(
    orderId: number,
    data: {
      reported_user_id: string
      reported_party_type: "SELLER" | "BUYER"
      reason_code: string
      description?: string
      files?: File[]
    }
  ): Promise<{ code: number; created: boolean; data: ReportResponse; status: string }> {
    const formData = new FormData()
    formData.append("reported_user_id", data.reported_user_id)
    formData.append("reported_party_type", data.reported_party_type)
    formData.append("reason_code", data.reason_code)
    if (data.description) {
      formData.append("description", data.description)
    }
    if (data.files) {
      data.files.forEach((file) => {
        formData.append("files", file)
      })
    }
    return http.postItem(`/reports/orders/${orderId}`, formData)
  }
  async function getReports(params: {
    reported_party_type: "SELLER" | "BUYER"
    status?: "PENDING" | "RESOLVED" | "CLOSED"
    limit?: number
    page?: number
    q?: string
  }): Promise<{ code: number; data: PaginatedReports; status: string }> {
    const queryParams = new URLSearchParams()
    if (params.reported_party_type) queryParams.append("reported_party_type", params.reported_party_type)
    if (params.status) queryParams.append("status", params.status)
    if (params.limit) queryParams.append("limit", params.limit.toString())
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.q) queryParams.append("q", params.q)
    
    return http.getItems(`/reports?${queryParams.toString()}`)
  }

  async function getReportsMe(params: {
    status?: string
    limit?: number
    page?: number
    q?: string
  }): Promise<{ code: number; data: PaginatedReports; status: string }> {
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append("status", params.status)
    if (params.limit) queryParams.append("limit", params.limit.toString())
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.q) queryParams.append("q", params.q)
    
    return http.getItems(`/reports/me?${queryParams.toString()}`)
  }

  async function getReportDetail(reportId: string | number): Promise<{ code: number; data: ReportDetailResponse; status: string }> {
    return http.getItems(`/reports/${reportId}`)
  }

  async function actionReport(
    reportId: string | number,
    data: {
      action_type: "NO_ACTION" | "WARN_USER" | "SUSPEND_USER" | "BAN_USER"
      target_user_id?: string
      target_store_id?: number
      user_role?: "SELLER" | "BUYER"
      suspend_days?: number
      is_permanent?: boolean
      note?: string
    }
  ): Promise<{ code: number; data: any; status: string }> {
    return http.postItem(`/reports/${reportId}/action`, data)
  }

  async function getMyReportDetail(reportId: string | number): Promise<{ code: number; data: MyReportDetailResponse; status: string }> {
    return http.getItems(`/reports/me/${reportId}`)
  }

  return { createOrderReport, getReports, getReportsMe, getReportDetail, getMyReportDetail, actionReport }
}
