import { useCrudApi } from "../utils/fetch"
import type { ApiResponse, ApiUpdatedResponse, PaginatedResponse } from "./responseType"

export interface orderSellerRequest {
  fulfillment_type: "STANDARD" | "EXPRESS"
  promised_ship_date: string
  deposit_amount: number
}
export type OrderStatusGroup = "active" | "completed" | "cancelled"

export interface orderSellerData {
  id: number  // backend ส่ง "id" ไม่ใช่ "order_id"
  status: string
  total_price: number
  order_date: string
  updated_at: string
  cancelled_at: string
  cancelled_reason?: string
  cancelled_by?: string
  user_id: string
  store_id: number
  notes?: string
  
  // Delivery fields
  delivery_method: string
  delivery_address_id?: number
  campus_location_id?: number
  campus_detail_note?: string
  
  // Meeting/Proposal fields
  proposed_at?: string
  meeting_date?: string
  meeting_time?: string
  meeting_location_id?: number
  meeting_note?: string
}
export interface orderSellerResponse {
  order: orderSellerData
  buyer_id: number
  buyer_display_name: string
  buyer_email: string
}

// ---------------------------------------

export interface OrderItemDetail {
  order_item_id: number
  quantity: number
  unit_price: number
  fulfillment_type: string
  subtotal: number
  deposit_amount: number
  promised_ship_date: string
  order_id: number
  product_id: number
  product_name: string
  product_image_url?: string
  variant_label?: string
}

export interface OrderBuyerDetail {
  id: string
  display_name: string
  email: string
}

// ---------------------------
export type OrderStatus =
  | "Pending Seller Confirmation"
  | "Awaiting Buyer Confirmation"
  | "Ready for Pickup"
  | "Ready for Delivery"
  | "Completed"
  | "Cancelled"

export interface OrderDetailResponse {
  order: orderSellerData
  items: OrderItemDetail[]
  buyer: OrderBuyerDetail
  buyer_name:string
  seller_name:string
  seller_user_id:string
  store_name:string
  store_profile_url:string
}
export interface OrderStatusResquest {
  status: OrderStatus
}

export interface StoreSummaryCards {
  total_orders: number
  total_revenue: number
  pending_orders: number
  cancelled_orders: number
  completed_orders: number
  average_order_value: number
  total_customers: number
  total_items_sold: number
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface TopProduct {
  product_id: number
  product_name: string
  total_sold: number
  revenue: number
}

export interface StoreSummaryResponse {
  cards: StoreSummaryCards
  revenue_by_period: RevenueDataPoint[]
  status_distribution: StatusCount[]
  top_products: TopProduct[]
  period_from: string
  period_to: string
}


export function useOrderSellerApi() {
  const http = useCrudApi()

  async function getOrdersSellerByStatus(
    store_id: number,
    status: OrderStatusGroup,
    limit: number = 10,
    page: number = 1
  ): Promise<PaginatedResponse<orderSellerResponse>> {
    return http.getItems(
      `/stores/${store_id}/orders?status_group=${status}&limit=${limit}&page=${page}`
    )
  }

  async function getOrderDetail(
    orderId: number
  ): Promise<ApiResponse<OrderDetailResponse>> {
    return http.getItems(`/orders/${orderId}`)
  }

  async function updateOrderStatus(
    orderId: number,
    orderStatus: OrderStatusResquest
  ): Promise<ApiUpdatedResponse<orderSellerData>> {
    return http.putItem(`/orders/${orderId}/status`, orderStatus)
  }

  async function cancelledOrder(
    orderId: number,
    reason?: string
  ): Promise<ApiUpdatedResponse<orderSellerData>> {
    return http.postItem(`/orders/${orderId}/cancel`, { reason })
  }

  async function proposeOrder(
    orderId: number,
    proposedAt: string,
    meetingLocationId?: number,
    meetingNote?: string
  ): Promise<ApiUpdatedResponse<orderSellerData>> {
    return http.putItem(`/orders/${orderId}/propose`, { 
      proposed_at: proposedAt,
      meeting_location_id: meetingLocationId,
      meeting_note: meetingNote
    })
  }

  async function acceptOrder(
    orderId: number
  ): Promise<ApiUpdatedResponse<orderSellerData>> {
    return http.postItem(`/orders/${orderId}/accept`, { accept: true })
  }

  async function getOrderSummaries(
    storeId: number,
    granularity: "daily" | "monthly" | "yearly" | "all_time",
    from?: string,
    to?: string
  ): Promise<ApiResponse<StoreSummaryResponse>> {
    let url = `/stores/${storeId}/orders/summaries?granularity=${granularity}`
    if (from) url += `&from=${from}`
    if (to) url += `&to=${to}`
    return http.getItems(url)
  }


  return {
    getOrdersSellerByStatus,
    getOrderDetail,
    updateOrderStatus,
    cancelledOrder,
    proposeOrder,
    acceptOrder,
    getOrderSummaries,
  }
}
