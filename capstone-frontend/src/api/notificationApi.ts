// src/api/notificationApi.ts
import { useCrudApi } from "../utils/fetch"

export interface NotificationData {
  message_preview?: string
  message_type?: string
  new_status?: string
  old_status?: string
}

export interface Notification {
  notification_id: number
  user_id: string
  type: "CHAT_NEW_MESSAGE" | "ORDER_STATUS_CHANGED"
  order_id: number
  thread_id?: number
  message_id?: number
  store_id?: number
  store_name?: string
  actor_user_id: string
  actor_display_name: string
  title: string
  body: string
  data: NotificationData
  is_read: boolean
  created_at: string
}

export interface NotificationsData {
  before_id: number | null
  count: number
  notifications: Notification[]
}

export function useNotificationApi() {
  const http = useCrudApi()

  async function getNotifications(
    limit: number = 5,
    type?: "CHAT_NEW_MESSAGE" | "ORDER_STATUS_CHANGED"
  ): Promise<NotificationsData> {
    let url = `/notifications?limit=${limit}`
    if (type) url += `&type=${type}`
    return http.getItems(url)
  }

  return { getNotifications }
}
