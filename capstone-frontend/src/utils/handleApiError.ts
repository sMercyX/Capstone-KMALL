import { toast } from "react-toastify"
import { AxiosError } from "axios"
import type { ApiResponse } from "../api/responseType"

export const handleApiError = (error: unknown) => {
  let message = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง"

  if (error instanceof AxiosError) {
    // Check if the error response has data matching our ApiResponse structure
    const data = error.response?.data as ApiResponse<unknown> | undefined
    
    if (data && data.message) {
      message = data.message
    } else if (error.message) {
        // Fallback to axios error message if no specific backend message
        // But usually backend message is preferred. 
        // If it's a network error, error.message might be "Network Error"
        message = error.message
    }
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  }

  toast.error(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  })
}
