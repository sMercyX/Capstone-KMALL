// src/api/chatApi.ts
import { useCrudApi } from "../utils/fetch"
import type { ApiResponse } from "./responseType"

// ============ Types ============

export interface ChatThread {
  thread_id: number
  order_id: number
  store_id: number
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
}

export interface ChatAttachment {
  attachment_id: number
  message_id: number
  file_url: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export interface ChatMessage {
  message_id: number
  thread_id: number
  sender_id: string
  message_text: string
  message_type: "TEXT" | "IMAGE"
  created_at: string
  moderation_status: "VISIBLE" | "HIDDEN" | "PENDING"
}

export interface MessageWithAttachments {
  message: ChatMessage
  attachments: ChatAttachment[]
}

export interface ReadState {
  thread_id: number
  user_id: string
  last_read_message_id?: number
  last_read_at?: string
}

export interface ThreadResponse {
  thread: ChatThread
}

export interface MessagesResponse {
  thread_id: number
  messages: MessageWithAttachments[]
  read_state: {
    me: ReadState
    other: ReadState
  }
}

export interface ReadResponse {
  thread_id: number
  user_id: string
  last_read_message_id: number
  last_read_at: string
}

export interface SendMessageResponse {
  message: ChatMessage
  attachments: ChatAttachment[]
}

// ============ Hook ============

export function useChatApi() {
  const http = useCrudApi()

  /**
   * เปิด/สร้าง chat thread สำหรับ order
   */
  async function openThread(orderId: number): Promise<ApiResponse<ThreadResponse>> {
    return http.postItem(`/order-chats/orders/${orderId}/thread`, {})
  }

  /**
   * ดึงข้อความทั้งหมดใน thread
   */
  async function getMessages(threadId: number): Promise<ApiResponse<MessagesResponse>> {
    return http.getItems(`/order-chats/${threadId}/messages`)
  }

  /**
   * อ่านข้อความ (mark as read)
   */
  async function markAsRead(
    threadId: number,
    lastReadMessageId: number
  ): Promise<ApiResponse<ReadResponse>> {
    return http.postItem(`/order-chats/${threadId}/read`, {
      last_read_message_id: lastReadMessageId,
    })
  }

  /**
   * ส่งข้อความ (รองรับ text + attachments)
   */
  async function sendMessage(
    threadId: number,
    messageText: string,
    attachments?: File[]
  ): Promise<ApiResponse<SendMessageResponse>> {
    const formData = new FormData()
    formData.append("message_text", messageText)

    const messageType = (attachments && attachments.length > 0) ? "IMAGE" : "TEXT"
    formData.append("message_type", messageType)

    if (attachments && attachments.length > 0) {
      attachments.forEach((file) => {
        formData.append("files", file)
      })
    }

    return http.postItem(`/order-chats/${threadId}/messages`, formData)
  }

  return {
    openThread,
    getMessages,
    markAsRead,
    sendMessage,
  }
}
