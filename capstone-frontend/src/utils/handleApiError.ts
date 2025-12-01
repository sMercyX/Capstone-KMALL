import { toast } from "react-toastify"
// import { AxiosError } from "axios"
// import type { ApiResponse } from "../api/responseType"

interface BackendError {
  message?: string
  error?: string
  detail?: string
}

export const handleApiError = (error: unknown) => {
  let message = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง"

  const err = error as any
  const data = err?.response?.data as BackendError | string | undefined

  // Prioritize backend error message
  if (data) {
    if (typeof data === "string") {
      message = data
    } else {
      if (data.message) {
        message = data.message
      } else if (data.error) {
        message = data.error // Some backends use 'error'
      }
    }
  } else if (err?.message) {
    // Fallback to error message
    message = err.message
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
