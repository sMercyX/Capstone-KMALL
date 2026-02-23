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

  return { createOrderReport }
}
