// src/modules/StoreOrderDetailPage/OutOfDeliveryPage/OutOfDeliveryPage.tsx
import type { orderSellerData } from "../../../api/orderSellerApi"

interface OutOfDeliveryPageProps {
  order: orderSellerData
  locationName?: string
  viewMode: "buyer" | "seller"
}

export default function OutOfDeliveryPage({ order, locationName, viewMode  }: OutOfDeliveryPageProps) {
  // Parse proposed_at to get date and time
  const proposedDate = order.proposed_at
    ? new Date(order.proposed_at)
    : null

  const formattedDate = proposedDate
    ? proposedDate.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      })
    : '--/--/--'

  const formattedTime = proposedDate
    ? proposedDate.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '--:--'
  
  // Use passed locationName, or fallback to IDs if not provided
  const displayLocation = locationName || order.meeting_location_id || order.campus_location_id || '--'

  const statusText =
    viewMode === "buyer"
      ? "The seller is on the way to the meeting point."
      : "Have you arrived at the meeting point?"

  return (
    <div className="flex flex-col items-center">
      {/* Delivery Info Header */}
      <div className="w-full bg-gray-100 rounded-xl p-4 mb-8 text-center">
        <p className="text-xl font-semibold text-gray-800">
          {formattedDate} at {formattedTime} · Building {displayLocation}
        </p>
      </div>

      {/* Delivery Truck Icon */}
      <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-8">
        <svg className="w-20 h-20 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      </div>

      {/* Status Message */}
      <p className="text-xl font-semibold text-orange-500">{statusText}</p>
    </div>
  )
}
