import React from "react"
import { Check, Loader2, X, Clock, Package } from "lucide-react"
import { FaBiking } from "react-icons/fa"

interface OrderStatusLabelProps {
  status: string
  className?: string
  showIcon?: boolean
}

export default function OrderStatusLabel({ status, className = "", showIcon = true }: OrderStatusLabelProps) {
  const s = status.trim()
  const lowerS = s.toLowerCase()

  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    // Pending
    PENDING: { label: "Pending", color: "bg-yellow-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },
    Pending: { label: "Pending", color: "bg-yellow-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },
    "Pending Seller Confirmation": { label: "Pending", color: "bg-yellow-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },

    // Proposed
    PROPOSED: { label: "Proposed", color: "bg-blue-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },
    Proposed: { label: "Proposed", color: "bg-blue-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },
    "Awaiting Buyer Confirmation": { label: "Proposed", color: "bg-blue-400 text-white", icon: <Loader2 size={13} className="animate-spin" /> },

    // Accepted / Ready
    ACCEPTED: { label: "Accepted", color: "bg-green-500 text-white", icon: <Check size={13} /> },
    Accepted: { label: "Accepted", color: "bg-green-500 text-white", icon: <Check size={13} /> },
    "Ready for Pickup": { label: "Accepted", color: "bg-green-500 text-white", icon: <Check size={13} /> },
    "Ready for Delivery": { label: "Accepted", color: "bg-green-500 text-white", icon: <Check size={13} /> },

    // Shipping
    "Out For Delivery": { label: "Out For Delivery", color: "bg-indigo-500 text-white", icon: <FaBiking size={13} /> },
    "Arrived": { label: "Arrived", color: "bg-orange-500 text-white", icon: <Package size={13} /> },

    // Completed
    COMPLETED: { label: "Completed", color: "bg-green-600 text-white", icon: <Check size={13} /> },
    Completed: { label: "Completed", color: "bg-green-600 text-white", icon: <Check size={13} /> },

    // Cancelled
    CANCELLED: { label: "Cancelled", color: "bg-red-500 text-white", icon: <X size={13} /> },
    Cancelled: { label: "Cancelled", color: "bg-red-500 text-white", icon: <X size={13} /> },
  }

  let config = map[s]

  // Fallback for partial matches or different capitalization
  if (!config) {
    if (lowerS.includes("pending") || lowerS.includes("proposed")) {
      config = lowerS.includes("proposed") ? map["Proposed"] : map["Pending"]
    } else if (lowerS.includes("accepted") || lowerS.includes("ready") || lowerS.includes("delivery") || lowerS.includes("completed") || lowerS.includes("arrived")) {
      const isCompleted = lowerS.includes("completed")
      config = isCompleted ? map["Completed"] : map["Accepted"]
    } else if (lowerS.includes("cancelled")) {
      config = map["Cancelled"]
    } else {
      config = { label: status, color: "bg-gray-200 text-gray-700", icon: null }
    }
  }

  return (
    <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm whitespace-nowrap ${config.color} ${className}`}>
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  )
}
