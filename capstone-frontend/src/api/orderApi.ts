// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

export interface orderRequest {
  fulfillment_type: "STANDARD" | "EXPRESS"
  promised_ship_date: string
  deposit_amount: number
}
export type OrderStatusGroup  = "active" | "completed" | "cancelled"

export interface orderData {
  order_id: number
  status: string
  total_price: number
  order_date: string
  updated_at: string
  cancelled_at: string
  user_id: string
  store_id: number
}
export interface orderResponse {
  order: orderData
  store_name: string
}

export function useOrderApi() {
  const http = useCrudApi()

  async function getOrdersByStatus(
    path: OrderStatusGroup
  ): Promise<ApiResponse<orderResponse[]>> {
    return http.getItems(`/orders?status_group=${path}`)
  }

  return { getOrdersByStatus }
}
