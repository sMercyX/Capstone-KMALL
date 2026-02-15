import React from "react"
import { Check, FileText, Loader2, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"
import type { CampusLocation } from "../../api/campusLocationApi"

export type OrderStatusContext = "ongoing" | "completed" | "canceled"

interface OrderListItemProps {
  orderId: number
  index: number
  date: string
  totalPrice: number
  status: string
  title: string
  locationId?: number
  locations: CampusLocation[]
  context: OrderStatusContext
  isSeller: boolean
  onClick: () => void
}

function StatusBadge({ context }: { context: OrderStatusContext }) {
  if (context === "ongoing") {
    return (
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white text-[10px] shadow">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    )
  }

  if (context === "completed") {
    return (
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px] shadow">
        <Check className="h-3 w-3" />
      </span>
    )
  }

  return (
    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow">
      <X className="h-3 w-3" />
    </span>
  )
}

function mapStatusLabel(status: string): React.ReactNode {
  const map: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Pending", color: "bg-yellow-400 text-white" },
    Pending: { label: "Pending", color: "bg-yellow-400 text-white" },
    "Pending Seller Confirmation": { label: "Pending", color: "bg-yellow-400 text-white" },

    PROPOSED: { label: "Proposed", color: "bg-blue-400 text-white" },
    Proposed: { label: "Proposed", color: "bg-blue-400 text-white" },
    "Awaiting Buyer Confirmation": { label: "Proposed", color: "bg-blue-400 text-white" },

    ACCEPTED: { label: "Accepted", color: "bg-green-500 text-white" },
    Accepted: { label: "Accepted", color: "bg-green-500 text-white" },
    "Ready for Pickup": { label: "Accepted", color: "bg-green-500 text-white" },
    "Ready for Delivery": { label: "Accepted", color: "bg-green-500 text-white" },

    COMPLETED: { label: "Completed", color: "bg-green-500 text-white" },
    Completed: { label: "Completed", color: "bg-green-500 text-white" },

    CANCELLED: { label: "Cancelled", color: "bg-red-500 text-white" },
    Cancelled: { label: "Cancelled", color: "bg-red-500 text-white" },
  }

  const config = map[status] || { label: status, color: "bg-gray-200 text-gray-700" }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

export default function OrderListItem({
  orderId,
  index,
  date,
  totalPrice,
  status,
  title,
  locationId,
  locations,
  context,
  isSeller,
  onClick,
}: OrderListItemProps) {
  const navigate = useNavigate()
  const orderDate = date ? format(parseISO(date), 'd MMM yyyy') : ''

  // Find location name
  const location = locations.find((l) => l.id === locationId)
  const locationName = location ? `${location.name}` : "-"

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const path = isSeller ? `/store/orders/${orderId}/chat` : `/orders/${orderId}/chat`
    navigate(path)
  }

  // Alternate row colors: even = white, odd = light orange
  const rowBg = index % 2 === 0 ? "bg-orange-50" : "bg-white"

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-6 py-4 transition-all hover:bg-orange-100 cursor-pointer ${rowBg}`}
    >
      {/* 1. Index & Icon */}
      <div className="flex items-center gap-3 w-[10%] min-w-[60px]">
        <div className="font-medium text-gray-500 text-sm">{index + 1}</div>
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-100 text-orange-500">
            <FileText className="h-4 w-4" />
          </div>
          <StatusBadge context={context} />
        </div>
      </div>

      {/* 2. Title (Store/Buyer) */}
      <div className="w-[20%] text-sm font-medium text-gray-800 truncate pr-2">
        {title}
      </div>

      {/* 3. Date */}
      <div className="w-[20%] text-sm text-gray-600 truncate pr-2">
        {orderDate}
      </div>

      {/* 4. Location */}
      <div className="w-[15%] text-sm text-gray-600 truncate pr-2">
        {locationName}
      </div>

      {/* 5. Total */}
      <div className="w-[15%] text-sm font-medium text-gray-800">
        {totalPrice.toLocaleString()} THB
      </div>

      {/* 6. Status Badge */}
      <div className="w-[10%] flex justify-center">
        {mapStatusLabel(status)}
      </div>

      {/* 7. Chat Button */}
      <div className="w-[10%] flex justify-end">
        <button
          onClick={handleChatClick}
          className="text-sm font-bold text-gray-700 hover:text-orange-600 underline underline-offset-4 transition-all"
        >
          Chat
        </button>
      </div>
    </div>
  )
}

