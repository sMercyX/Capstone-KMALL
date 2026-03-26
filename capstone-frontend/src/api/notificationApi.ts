import { useCallback, useMemo } from "react"
import { useCrudApi } from "../utils/fetch"

export interface NotificationData {
  message_preview?: string
  message_type?: string
  new_status?: string
  old_status?: string
  // Fields for REPORT_ACTION_TAKEN
  action_type?: string
  ban_type?: string
  note?: string
  reason?: string
  report_id?: number
}

export type NotificationType =
  | "CHAT_NEW_MESSAGE"
  | "ORDER_STATUS_CHANGED"
  | "ANNOUNCEMENT"
  | "REPORT_ACTION_TAKEN"

export interface Notification {
  notification_id: number
  user_id: string
  type: NotificationType
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

  const getNotifications = useCallback(
    async (
      limit: number = 5,
      type?: NotificationType
    ): Promise<NotificationsData> => {
      let url = `/notifications?limit=${limit}`
      if (type) url += `&type=${type}`
      return http.getItems(url)
    },
    [http]
  )

  const markAsRead = useCallback(
    async (notificationId: number): Promise<Notification> => {
      return http.postItem(`/notifications/${notificationId}/read`, {})
    },
    [http]
  )

  const deleteAllNotifications = useCallback(
    async (): Promise<{ deleted: boolean; deleted_rows: number }> => {
      return http.deleteItem(`/notifications`)
    },
    [http]
  )

  return useMemo(
    () => ({ getNotifications, markAsRead, deleteAllNotifications }),
    [getNotifications, markAsRead, deleteAllNotifications]
  )
}
