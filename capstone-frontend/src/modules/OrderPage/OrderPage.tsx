// src/pages/orders/OrderPage.tsx
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import SwitchTabs, {
  type SwitchTabItem,
} from "../../components/SwitchTabs/SwitchTabs"
import { useUserStore } from "../../stores/userStore"

import { useOrderStore, type OrderTabKey } from "../../stores/orderStore"
import {
  useOrderApi,
  type OrderStatusGroup,
} from "../../api/orderApi"
import OrderListItem, { type OrderStatusContext } from "../../components/Order/OrderListItem"
import { getAllLocations, type CampusLocation } from "../../api/campusLocationApi"

const ORDER_TABS: SwitchTabItem[] = [
  { key: "ongoing", label: "ON GOING", href: "/orders/ongoing" },
  { key: "completed", label: "COMPLETED", href: "/orders/completed" },
  { key: "canceled", label: "CANCELED/FAILED", href: "/orders/canceled" },
]



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
    <div className="flex items-center justify-between px-6 pb-2 text-xs text-gray-400 font-light">
      <div className="w-[10%] min-w-[60px]">ลำดับ</div>
      <div className="w-[20%]">ชื่อร้าน</div>
      <div className="w-[20%]">วัน/เวลาที่สั่งซื้อ</div>
      <div className="w-[15%]">สถานที่นัดรับสินค้า</div>
      <div className="w-[15%]">ยอดรวมทั้งหมด</div>
      <div className="w-[10%] text-center">สถานะคำสั่งซื้อ</div>
      <div className="w-[10%]"></div>
    </div>
  )
}

export default function OrderPage() {
  const location = useLocation()
  const navigate = useNavigate()
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
  const [locations, setLocations] = useState<CampusLocation[]>([])

  // Load locations once
  useEffect(() => {
    getAllLocations().then(setLocations).catch(console.error)
  }, [])

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
          setError("Unable to load orders.")
        }
      }
    })()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]) // เฉพาะ activeKey เพื่อป้องกัน fetch ซ้ำ

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
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

      <div className="text-left mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
           คลิกเพื่อดูรายละเอียดออเดอร์
        </h2>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[500px]">
        <OrderListHeader />

        <div className="space-y-1 mt-2">
          {isLoading && (
            <p className="text-center text-sm text-gray-500 mt-6"><Loader2 className="animate-spin inline mr-2"/>Loading...</p>
          )}

          {error && <p className="text-center text-sm text-red-500 mt-6">{error}</p>}

          {!isLoading && !error && orders.length === 0 && (
            <p className="text-center text-sm text-gray-500 mt-6">
              No orders found.
            </p>
          )}

          {!isLoading &&
            !error &&
            orders.map((item, idx) => (
              <OrderListItem
                key={item.order.id}
                orderId={item.order.id}
                index={idx}
                date={item.order.order_date}
                totalPrice={item.order.total_price}
                status={item.order.status}
                title={item.store_name}
                locationId={item.order.campus_location_id}
                locations={locations}
                context={contextMap[activeKey]}
                isSeller={false}
                onClick={() => navigate(`/orders/${item.order.id}`)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

