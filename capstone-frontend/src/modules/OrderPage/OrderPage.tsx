// src/pages/orders/OrderPage.tsx
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import BackButton from "../../components/Buttons/BackButton"
import SwitchTabs, {
  type SwitchTabItem,
} from "../../components/SwitchTabs/SwitchTabs"


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
      <div className="w-[10%] min-w-[60px]">No.</div>
      <div className="w-[20%]">Store</div>
      <div className="w-[20%]">Order Date</div>
      <div className="w-[15%]">Pickup Location</div>
      <div className="w-[15%]">Total</div>
      <div className="w-[10%] text-center">Status</div>
      <div className="w-[10%]"></div>
    </div>
  )
}

export default function OrderPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname


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
    <div className="max-w-6xl mx-auto py-10 px-4 relative">
      <BackButton className="absolute left-4 top-10" />

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-wide text-gray-800">
          MY ORDER{" "}
          <span
            className={
              activeKey === "ongoing"
                ? "text-orange-400"
                : activeKey === "completed"
                ? "text-green-500"
                : "text-red-500"
            }
          >
            {activeKey === "ongoing"
              ? "ON GOING"
              : activeKey === "completed"
              ? "COMPLETED"
              : "CANCELED"}
          </span>
        </h1>
      </div>

      <SwitchTabs
        tabs={ORDER_TABS}
        rootPath="/orders/ongoing"
        className="mb-6"
      />

      <div className="text-left mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          Click to view order details
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

