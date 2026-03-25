import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, MessageCircle, Trash2 } from "lucide-react"
import {
  useNotificationApi,
  type Notification,
} from "../../api/notificationApi"
import { useNotificationWebSocket } from "../../hooks/useNotificationWebSocket"
import { useUserStore } from "../../stores/userStore"
import { useStoreStore } from "../../stores/storeStore"
import ConfirmationModal from "../Modal/ConfirmationModal"

type Tab = "ALL" | "CHAT" | "ORDER"

type Props = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (diffDays === 0) return `Today at ${timeStr}`
  if (diffDays === 1) return `Yesterday at ${timeStr}`
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
    return `Last ${dayName} at ${timeStr}`
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function NotificationDropdown({
  isOpen,
  onToggle,
  onClose,
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [allUnreadCount, setAllUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("ALL")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { getNotifications, markAsRead, deleteAllNotifications } = useNotificationApi()
  const userID = useUserStore((s) => s.id)
  const roles = useUserStore((s) => s.roles)
  const myStoreId = useStoreStore((s) => s.store?.id)
  const fetchStore = useStoreStore((s) => s.fetchStore)

  // ถ้า user เป็น seller ให้ fetch store ตอน mount เพื่อให้ได้ store id
  const hasSeller = roles?.some((r) => r.toLowerCase() === "seller")
  useEffect(() => {
    if (hasSeller && !myStoreId) {
      fetchStore()
    }
  }, [hasSeller, myStoreId, fetchStore])

  // Fetch ALL notifications (for badge count)
  const fetchAllForBadge = useCallback(async () => {
    try {
      const res = await getNotifications(10)
      const items = res.notifications ?? []
      setAllUnreadCount(items.filter((n: Notification) => !n.is_read).length)
      return items
    } catch (err) {
      console.error("Failed to load notifications", err)
      return []
    }
  }, [])

  // WebSocket: เมื่อมี noti ใหม่ → re-fetch ALL สำหรับ badge
  const handleWsNotification = useCallback(async () => {
    const allItems = await fetchAllForBadge()
    // ถ้า tab เป็น ALL อยู่ → อัพเดทลิสต์ด้วย
    setNotifications((prev) => {
      // Check current activeTab via the latest notifications context
      // If it's showing ALL, update the list too
      return allItems.length > 0 ? allItems : prev
    })
  }, [fetchAllForBadge])

  useNotificationWebSocket(userID || undefined, handleWsNotification)

  // Map tab to API type param
  const typeParam =
    activeTab === "CHAT"
      ? "CHAT_NEW_MESSAGE" as const
      : activeTab === "ORDER"
        ? "ORDER_STATUS_CHANGED" as const
        : undefined

  // Fetch on initial mount: badge + list
  useEffect(() => {
    ;(async () => {
      const items = await fetchAllForBadge()
      setNotifications(items)
    })()
  }, [fetchAllForBadge])

  // Re-fetch when dropdown opens or tab changes (list only)
  useEffect(() => {
    if (!isOpen) return

    ;(async () => {
      try {
        setLoading(true)
        // Always update badge from ALL
        fetchAllForBadge()
        // Fetch filtered list for the active tab
        const res = await getNotifications(10, typeParam)
        setNotifications(res.notifications ?? [])
      } catch (err) {
        console.error("Failed to load notifications", err)
      } finally {
        setLoading(false)
      }
    })()
  }, [isOpen, activeTab])

  // Click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  // Badge ใช้ allUnreadCount เสมอ (จาก ALL)
  const unreadCount = allUnreadCount

  async function handleAction(n: Notification) {
    onClose()

    // Mark as read
    if (!n.is_read) {
      try {
        await markAsRead(n.notification_id)
        // อัพเดท local state ทันที → จุดส้มหาย + bg เป็นสีขาว
        setNotifications((prev) =>
          prev.map((item) =>
            item.notification_id === n.notification_id
              ? { ...item, is_read: true }
              : item
          )
        )
        fetchAllForBadge()
      } catch (err) {
        console.error("Failed to mark notification as read", err)
      }
    }

    // ถ้า store_id ของ noti ตรงกับ store ของเรา → เราเป็น seller
    const isSeller = !!myStoreId && !!n.store_id && n.store_id === myStoreId
    const isChat = n.type === "CHAT_NEW_MESSAGE"

    if (isSeller) {
      // Seller paths
      navigate(isChat ? `/store/orders/${n.order_id}/chat` : `/store/orders/${n.order_id}`)
    } else {
      // Buyer paths
      navigate(isChat ? `/orders/${n.order_id}/chat` : `/orders/${n.order_id}`)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CHAT", label: "CHAT" },
    { key: "ORDER", label: "ORDER" },
  ]

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button className="relative cursor-pointer" onClick={onToggle}>
        <Bell
          className={`h-6 w-6 ${isOpen ? "text-orange-500" : "text-gray-500"}`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed inset-x-4 top-24 bg-white shadow-2xl z-50 overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200
                     md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 md:w-[380px] md:rounded-2xl md:border md:border-gray-200 md:shadow-xl md:bg-white md:animate-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Notifications
            </h3>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={notifications.length === 0}
              className={`cursor-pointer ${
                notifications.length === 0
                  ? "text-gray-200 cursor-not-allowed"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 px-5 border-b border-gray-100">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 text-sm font-medium cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? "text-orange-500 border-b-2 border-orange-500"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <p className="py-8 text-center text-sm text-gray-400">
                Loading...
              </p>
            )}

            {!loading && notifications.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No notifications
              </p>
            )}

            {!loading &&
              notifications.map((n) => {
                const isChat = n.type === "CHAT_NEW_MESSAGE"
                return (
                  <div
                    key={n.notification_id}
                    className={`px-5 py-4 border-b border-gray-50 ${
                      !n.is_read ? "bg-orange-50/60" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isChat
                            ? "bg-orange-500 text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {isChat ? (
                          <MessageCircle className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {isChat ? "💬" : "🛒"} {n.title} – ORDER #{n.order_id}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>

                        {/* Chat preview */}
                        {isChat && n.data?.message_preview && (
                          <div className="mt-1.5 border-l-2 border-gray-300 pl-2 text-xs text-gray-600">
                            <p>{n.data.message_preview}</p>
                            {n.data.message_type === "IMAGE" && (
                              <p className="text-gray-400">
                                ไฟล์แนบ: รูปภาพ 1 รูป
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action button */}
                        <button
                          onClick={() => handleAction(n)}
                          className="mt-2 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-semibold text-white hover:bg-orange-600 cursor-pointer"
                        >
                          {isChat ? "Chat" : "View details"}
                        </button>

                        {/* Timestamp */}
                        <p className="mt-1.5 text-[11px] text-gray-400">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          try {
            await deleteAllNotifications()
            setNotifications([])
            setAllUnreadCount(0)
          } catch (err) {
            console.error("Failed to delete notifications", err)
          }
        }}
        title="Delete all notifications"
        message="Are you sure you want to delete all notifications? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
