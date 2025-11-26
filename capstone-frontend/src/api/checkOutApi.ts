// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiCreateResponse } from "./responseType"

export interface orderCreatedRequest {
  fulfillment_type: "STANDARD" | "EXPRESS"
  promised_ship_date: string
  deposit_amount: number
}

export interface orderData {
  order_id: number
  status: string
  total_price: number
  order_date: string
  updated_at: string
  cancelled_at: string
  user_id: number
  store_id: number
}

export interface orderItems {
  order_item_id: number
  quantity: number
  unit_price: number
  fulfillment_type: string
  subtotal: number
  deposit_amount: number
  promised_ship_date: string
  order_id: number
  product_id: number
}

export interface orderCreatedResponse {
  items: orderItems[]
  pageIndex: number
  pageSize: number
  total: number
  totalQuantity: number
  order: orderData
}

export function useCheckkOutApi() {
  const http = useCrudApi()

  async function checkOutOrder(
    data: orderCreatedRequest
  ): Promise<ApiCreateResponse<orderCreatedResponse>> {
    return http.postItem(`/api/checkout/confirm`, data)
  }

  return { checkOutOrder }
}
