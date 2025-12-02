// src/components/Order/OrderListItem.tsx
import { Check, Coffee, Loader2, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatThaiDate } from "../../utils/dateFormatter"

export type OrderStatusContext = "ongoing" | "completed" | "canceled"

export interface OrderSummary {
  order: {
    order_id: number
    status: string
    total_price: number
    order_date: string
    updated_at: string
    cancelled_at: string | null
    user_id: string
    store_id: number
  }
  store_name: string
}

interface OrderListItemProps {
  data: OrderSummary
  context: OrderStatusContext   // บอกว่าตอนนี้อยู่หน้าไหน (ongoing/completed/canceled)
}

function StatusBadge({ context }: { context: OrderStatusContext }) {
  if (context === "ongoing") {
    return (
      <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white text-[10px] shadow">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    )
  }

  if (context === "completed") {
    return (
      <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px] shadow">
        <Check className="h-3 w-3" />
      </span>
    )
  }

  // canceled
  return (
    <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow">
      <X className="h-3 w-3" />
    </span>
  )
}

export default function OrderListItem({
  data,
  context,
}: OrderListItemProps) {
  const { order } = data
  const orderDate = formatThaiDate(order.order_date)
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/orders/${order.order_id}`)}
      className="block w-full text-left"
    >
      <div className="flex items-center gap-6 rounded-2xl border border-gray-200 px-6 py-4 shadow-sm hover:shadow-md transition">
        {/* โลโก้ร้าน + badge สถานะ */}
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200">
            <Coffee className="h-7 w-7 text-gray-700" />
          </div>
          <StatusBadge context={context} />
        </div>

        {/* ข้อมูลคำสั่งซื้อ */}
        <div className="flex-1 grid grid-cols-4 items-center text-center text-sm md:text-base">
          <div className="font-medium">#{order.order_id}</div>
          <div>{orderDate}</div>
          <div>{order.total_price.toLocaleString()} บาท</div>
          <div className="font-semibold uppercase">{order.status}</div>
        </div>
      </div>
    </button>
  )
}
