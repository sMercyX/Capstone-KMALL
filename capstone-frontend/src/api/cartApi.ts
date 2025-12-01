// src/api/storeApi.ts
import { useCrudApi } from "../utils/fetch"
import type {
  ApiCreateResponse,
  ApiResponse,
  ApiUpdatedResponse,
} from "./responseType"

export interface cartRequset {
  product_id: number
  quantity: number
}
export interface cartUpdatedRequset {
  quantity: number
}
export interface cartUpdatedResponse {
  id: number
  cart_id: number
  product_id: number
  quantity: number
}
export interface cartResponse {
  cart_id: number
  id: number
  product_id: number
  product_image_url: string
  product_name: string
  product_price: number
  quantity: number
  store_id: number
  store_name: string
  subtotal: number
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

export interface deleteItemResponse{
  deleted:boolean
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
  async function deleteItemCart(item_id:number): Promise<ApiResponse<deleteItemResponse>> {
    return http.deleteItem(`/api/cart/items/${item_id}`)
  }
  async function updateCart(
    product_id:number,
    data: cartUpdatedRequset
  ): Promise<ApiUpdatedResponse<cartUpdatedResponse>> {
    return http.putItem(`/api/cart/items/${product_id}`, data)
  }

  return { addCart, getCart, deleteItemCart, updateCart }
}
