import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, MessageCircle, Trash2, Megaphone, ShieldAlert, ShoppingCart } from "lucide-react"
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
  const [displayLimit, setDisplayLimit] = useState(5)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const api = useNotificationApi()
  const userID = useUserStore((s) => s.id)
  const roles = useUserStore((s) => s.roles)
  const myStoreId = useStoreStore((s) => s.store?.id)
  const fetchStore = useStoreStore((s) => s.fetchStore)

  // Use a ref to capture the latest API methods without triggering effects
  const apiRef = useRef(api)
  useEffect(() => {
    apiRef.current = api
  })

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
      const res = await apiRef.current.getNotifications(10)
      const items = res.notifications ?? []
      setAllUnreadCount(items.filter((n: Notification) => !n.is_read).length)
      return items
    } catch (err) {
      console.error("Failed to load notifications", err)
      return []
    }
  }, [])

  // Map tab to API type param
  const typeParam =
    activeTab === "CHAT"
      ? ("CHAT_NEW_MESSAGE" as const)
      : activeTab === "ORDER"
      ? ("ORDER_STATUS_CHANGED" as const)
      : undefined

  // WebSocket: เมื่อมี noti ใหม่ → re-fetch badge count
  const handleWsNotification = useCallback(async () => {
    // 1. Update Badge
    const allItems = await fetchAllForBadge()

    // 2. If dropdown is open and we are on ALL tab, update list too
    if (isOpen && activeTab === "ALL") {
      setNotifications(allItems.slice(0, displayLimit))
    }
  }, [fetchAllForBadge, isOpen, activeTab, displayLimit])

  useNotificationWebSocket(userID || undefined, handleWsNotification)

  // Fetch on initial mount: badge count
  useEffect(() => {
    fetchAllForBadge()
  }, [fetchAllForBadge])

  // Re-fetch when dropdown opens, tab changes, or limit changes (list only)
  useEffect(() => {
    if (!isOpen) return

    ;(async () => {
      try {
        setLoading(true)
        // Always sync badge from ALL
        fetchAllForBadge()
        // Fetch specific list for the active tab with the current limit
        const res = await apiRef.current.getNotifications(displayLimit, typeParam)
        setNotifications(res.notifications ?? [])
      } catch (err) {
        console.error("Failed to load notifications", err)
      } finally {
        setLoading(false)
      }
    })()
  }, [isOpen, activeTab, displayLimit, fetchAllForBadge, typeParam])

  // Click outside detection
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

  const unreadCount = allUnreadCount

  async function handleAction(n: Notification) {
    onClose()

    if (!n.is_read) {
      try {
        await apiRef.current.markAsRead(n.notification_id)
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

    const isSeller = !!myStoreId && !!n.store_id && n.store_id === myStoreId
    const isChat = n.type === "CHAT_NEW_MESSAGE"
    const isAnnouncement = n.type === "ANNOUNCEMENT"
    const isReport = ["ADMIN_ACTION" , "REPORT_ACTION_TAKEN"].includes(n.type)

    if (isAnnouncement) return

    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "")

    if (isReport) {
      if (isSeller || roles?.some(r => r.toLowerCase() === 'seller')) {
        window.open(baseUrl + "/store/report", "_blank")
      } else {
        navigate("/reports")
      }
      return
    }

    if (isSeller) {
      const path = isChat
        ? `/store/orders/${n.order_id}/chat`
        : `/store/orders/${n.order_id}`
      window.open(baseUrl + path, "_blank")
    } else {
      navigate(isChat ? `/orders/${n.order_id}/chat` : `/orders/${n.order_id}/`)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CHAT", label: "CHAT" },
    { key: "ORDER", label: "ORDER" },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        className="relative cursor-pointer p-2 text-gray-500 hover:text-orange-500 transition-colors"
        onClick={onToggle}
      >
        <Bell className={`h-6 w-6 ${isOpen ? "text-orange-500" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="fixed inset-x-4 top-24 z-50 overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200
                     md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 md:w-[380px] md:rounded-2xl md:border md:border-gray-200 md:shadow-xl md:animate-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Notifications
            </h3>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={notifications.length === 0}
              className={`cursor-pointer ${
                notifications.length === 0
                  ? "cursor-not-allowed text-gray-200"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-100 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  setDisplayLimit(5) // Reset limit when tab changes
                }}
                className={`cursor-pointer pb-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-orange-500 text-orange-500"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                Loading...
              </p>
            )}

            {!loading && notifications.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No notifications
              </p>
            )}

            {notifications.map((n) => {
              const isChat = n.type === "CHAT_NEW_MESSAGE"
              const isAnnouncement = n.type === "ANNOUNCEMENT"
              const isReport = ["ADMIN_ACTION" , "REPORT_ACTION_TAKEN"].includes(n.type)


              return (
                <div
                  key={n.notification_id}
                  className={`group cursor-pointer border-b border-gray-50 px-5 py-4 transition-colors hover:bg-orange-50 ${
                    !n.is_read
                      ? isAnnouncement
                        ? "bg-red-50/40"
                        : isReport
                        ? "bg-indigo-50/60"
                        : "bg-orange-50/60"
                      : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:text-white ${
                        isAnnouncement
                          ? "bg-red-50 text-red-500 group-hover:bg-red-500"
                          : isChat
                          ? "bg-gray-100 text-gray-500 group-hover:bg-orange-500"
                          : isReport
                          ? "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600"
                          : "bg-gray-100 text-gray-500 group-hover:bg-orange-500"
                      }`}
                    >
                      {isAnnouncement ? (
                        <Megaphone className="h-4 w-4" />
                      ) : isChat ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : isReport ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13px] ${
                          isAnnouncement
                            ? "font-bold text-[#FF4C24]"
                            : isReport
                            ? "font-bold text-indigo-700"
                            : "font-semibold text-gray-900"
                        }`}
                      >
                        {isAnnouncement ? (
                          <Megaphone className="inline-block mr-1.5 h-3.5 w-3.5 mb-0.5" />
                        ) : isReport ? (
                          <ShieldAlert className="inline-block mr-1.5 h-3.5 w-3.5 mb-0.5" />
                        ) : isChat ? (
                          <MessageCircle className="inline-block mr-1.5 h-3.5 w-3.5 mb-0.5" />
                        ) : (
                          <ShoppingCart className="inline-block mr-1.5 h-3.5 w-3.5 mb-0.5" />
                        )}

                        {isAnnouncement
                          ? "System Announcement"
                          : isReport
                          ? "Report Case"
                          : ""}
                        {!isAnnouncement && !isReport && n.title}
                        {!isAnnouncement && !isReport && ` – ORDER #${n.order_id}`}
                      </p>

                      {(isAnnouncement || isReport) && (
                        <p className="mt-1 text-[13.5px] font-bold leading-tight text-gray-800">
                          {n.title}
                        </p>
                      )}

                      <div
                        className={`mt-1.5 ${
                          isAnnouncement || isReport
                            ? `border-l-2 pl-3 transition-colors group-hover:border-orange-300 ${
                                isAnnouncement ? "border-red-200" : "border-indigo-200"
                              }`
                            : ""
                        }`}
                      >
                        {isReport && (
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                              {n.data.ban_type ?? "ACTION TAKEN"}
                            </span>
                          </div>
                        )}
                        <p
                          className={`text-xs ${
                            isAnnouncement || isReport
                              ? "leading-relaxed text-gray-600"
                              : "text-gray-500"
                          }`}
                        >
                          {isReport ? (n.data.note || n.body) : n.body}
                        </p>
                      </div>

                      {/* Chat preview */}
                      {isChat && n.data?.message_preview && (
                        <div className="mt-1.5 border-l-2 border-orange-300 pl-2 text-xs text-gray-600">
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
                        className={`mt-2.5 inline-block cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-semibold transition-colors ${
                          isAnnouncement
                            ? "border border-[#FF4C24] bg-white text-[#FF4C24] hover:bg-red-50"
                            : isReport
                            ? "border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50 font-bold"
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        }`}
                      >
                        {isAnnouncement
                          ? "Acknowledge"
                          : isChat
                          ? "Chat"
                          : isReport
                          ? "View Report Case"
                          : "View details"}
                      </button>

                      {/* Timestamp */}
                      <p className="mt-2.5 text-[10px] uppercase font-medium tracking-wide text-gray-400">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.is_read && (
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isReport ? "bg-indigo-600" : "bg-[#FF4C24]"
                        }`}
                      />
                    )}
                  </div>
                </div>
              )
            })}

            {/* See more button */}
            {!loading && notifications.length >= displayLimit && displayLimit < 50 && (
              <div className="p-4 flex justify-center">
                <button
                  onClick={() => setDisplayLimit(50)}
                  className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                >
                  See more
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          try {
            await apiRef.current.deleteAllNotifications()
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
