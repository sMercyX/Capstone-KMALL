// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type {
  ApiCreateResponse,
  ApiResponse,
} from "./responseType"

export interface cartRequset {
  product_id: number
  quantity: number
}
export interface cartResponse {
  id: number
  cart_id: number
  product_id: number
  quantity: number
}

export interface cartResponse2{
    id: number,
    user_id: number,
    created_at: string,
    updated_at: string
}

export interface PaginatedCartData {
  items: cartResponse[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalQuantity:number;
  cart: cartResponse2
}


export function useCartApi() {
  const http = useCrudApi()

  async function addCart(
    data: cartRequset
  ): Promise<ApiCreateResponse<cartResponse>> {
    return http.postItem(`/api/cart/items`, data)
  }

  async function getCart(): Promise<ApiResponse<PaginatedCartData>> {
    return http.getItems(`/api/cart`)
  }

  return { addCart, getCart }
}
