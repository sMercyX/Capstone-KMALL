// src/pages/orders/OrderPage.tsx
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import SwitchTabs, {
  type SwitchTabItem,
} from "../../components/SwitchTabs/SwitchTabs"
import { useUserStore } from "../../stores/userStore"

import { useOrderStore, type OrderTabKey } from "../../stores/orderStore"
import {
  useOrderApi,
  type OrderStatusGroup,
} from "../../api/orderApi"
import type { OrderStatusContext } from "./OrderListItem"
import OrderListItem from "./OrderListItem"

const ORDER_TABS: SwitchTabItem[] = [
  { key: "ongoing", label: "ON GOING", href: "/orders/ongoing" },
  { key: "completed", label: "COMPLETED", href: "/orders/completed" },
  { key: "canceled", label: "CANCELED/FAILED", href: "/orders/canceled" },
]

const titleMap: Record<OrderTabKey, string> = {
  ongoing: "MY ORDER ON GOING",
  completed: "MY ORDER COMPLETED",
  canceled: "MY ORDER CANCELED / FAILED",
}

const statusGroupMap: Record<OrderTabKey, OrderStatusGroup> = {
  ongoing: "active",
  completed: "completed",
  canceled: "cancelled",
}

const contextMap: Record<OrderTabKey, OrderStatusContext> = {
  ongoing: "ongoing",
  completed: "completed",
  canceled: "canceled",
}

function OrderListHeader() {
  return (
    <div className="flex items-center gap-6 px-6 pb-3 text-center text-xs md:text-sm font-medium text-gray-500">
      <div className="w-14 flex-shrink-0"></div>
      <div className="flex-1 grid grid-cols-4">
        <span>หมายเลขคำสั่งซื้อ</span>
        <span>วันที่สั่งซื้อ</span>
        <span>ยอดรวมทั้งหมด</span>
        <span>สถานะคำสั่งซื้อ</span>
      </div>
    </div>
  )
}

export default function OrderPage() {
  const location = useLocation()
  const pathname = location.pathname
  const name = useUserStore((s) => s.name) || "NITCHAN"

  const {
    activeKey,
    setActiveKey,
    orders,
    isLoading,
    error,
    startLoading,
    setOrders,
    setError,
  } = useOrderStore()

  const { getOrdersByStatus } = useOrderApi()

  // sync URL -> activeKey
  useEffect(() => {
    let routeKey: OrderTabKey = "ongoing"  // default
    if (pathname.startsWith("/orders/completed")) routeKey = "completed"
    else if (pathname.startsWith("/orders/canceled")) routeKey = "canceled"
    // else -> "ongoing" (default)

    if (activeKey !== routeKey) {
      setActiveKey(routeKey)
    }
  }, [pathname, setActiveKey, activeKey])

  // load data เมื่อ activeKey เปลี่ยน
  useEffect(() => {
    // Guard: ไม่ fetch ถ้า activeKey ยังไม่พร้อม
    if (!activeKey) return

    const group = statusGroupMap[activeKey]
    if (!group) return

    let isCancelled = false

    startLoading()
    setError(null)
    ;(async () => {
      try {
        const res = await getOrdersByStatus(group)
        if (!isCancelled) {
          setOrders(res.data ?? [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError("ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้")
        }
      }
    })()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]) // เฉพาะ activeKey เพื่อป้องกัน fetch ซ้ำ

  return (
    <div className="max-w-5xl mx-auto py-10">
      {/* banner */}
      <div className="mb-8">
        <div className="h-32 md:h-40 rounded-3xl bg-gradient-to-r from-orange-400 via-orange-500 to-pink-500 flex items-center justify-center">
          <p className="text-white font-extrabold tracking-[0.35em] text-lg md:text-2xl uppercase">
            HEY, {name.toUpperCase()} !
          </p>
        </div>
      </div>

      <SwitchTabs
        tabs={ORDER_TABS}
        rootPath="/orders/ongoing"
        className="mb-6"
      />

      <div className="text-center mb-6">
        <h2 className="text-xl md:text-2xl font-extrabold tracking-[0.3em]">
          {titleMap[activeKey]}
        </h2>
        <p className="mt-2 text-xs text-gray-500">
          คลิกเพื่อดูรายละเอียดออเดอร์
        </p>
      </div>

      <div className="border-b border-gray-200 mb-6"></div>

      <div className="space-y-3">
        <OrderListHeader />

        {isLoading && (
          <p className="text-center text-sm text-gray-500 mt-6">กำลังโหลด...</p>
        )}

        {error && <p className="text-center text-sm text-red-500 mt-6">{error}</p>}

        {!isLoading && !error && orders.length === 0 && (
          <p className="text-center text-sm text-gray-500 mt-6">
            ยังไม่มีคำสั่งซื้อในหมวดนี้
          </p>
        )}

        {!isLoading &&
          !error &&
          orders.map((item) => (
            <OrderListItem
              key={item.order.id}
              data={item}
              context={contextMap[activeKey]}
            />
          ))}
      </div>
    </div>
  )
}
