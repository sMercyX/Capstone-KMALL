// src/api/orderApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

export interface orderRequest {
  fulfillment_type: "STANDARD" | "EXPRESS"
  promised_ship_date: string
  deposit_amount: number
}
export type OrderStatusGroup  = "active" | "completed" | "cancelled"

export interface orderData {
  id: number  // backend ส่ง "id" ไม่ใช่ "order_id"
  status: string
  total_price: number
  order_date: string
  updated_at: string
  cancelled_at: string
  user_id: string
  store_id: number
  delivery_method: string
  delivery_fee: number
  delivery_address_id?: number
  campus_location_id?: number
}
export interface orderResponse {
  order: orderData
  store_name: string
}

export interface PaginatedOrderResponse {
  items: orderResponse[]
  page_index: number
  page_size: number
  total: number
}

export function useOrderApi() {
  const http = useCrudApi()

  async function getOrdersByStatus(
    path: OrderStatusGroup,
    limit: number = 10,
    page: number = 1,
    q: string = ""
  ): Promise<ApiResponse<PaginatedOrderResponse>> {
    const searchParam = q ? `&q=${encodeURIComponent(q)}` : ""
    return http.getItems(`/orders?status_group=${path}&limit=${limit}&page=${page}${searchParam}`)
  }

  return { getOrdersByStatus }
}
