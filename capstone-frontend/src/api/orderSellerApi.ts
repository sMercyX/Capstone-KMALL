// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

export interface orderSellerRequest {
  fulfillment_type: "STANDARD" | "EXPRESS"
  promised_ship_date: string
  deposit_amount: number
}
export type OrderStatusGroup = "active" | "completed" | "cancelled"

export interface orderSellerData {
  order_id: number
  status: string
  total_price: number
  order_date: string
  updated_at: string
  cancelled_at: string
  user_id: string
  store_id: number
}
export interface orderSellerResponse {
  order: orderSellerData
  buyer_id: number
  buyer_display_name: string
  buyer_email: string
}

export function useOrderSellerApi() {
  const http = useCrudApi()

  async function getOrdersSellerByStatus(
    store_id: number,
    status: OrderStatusGroup
  ): Promise<ApiResponse<orderSellerResponse[]>> {
    return http.getItems(
      `/api/stores/${store_id}/orders?status_group=${status}`
    )
  }

  return { getOrdersSellerByStatus }
}
