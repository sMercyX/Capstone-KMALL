// src/modules/StoreOrderDetailPage/AcceptedPage/AcceptedPage.tsx
import type { orderSellerData } from "../../../api/orderSellerApi"

interface AcceptedPageProps {
  order: orderSellerData
  locationName?: string
}

export default function AcceptedPage({ order, locationName }: AcceptedPageProps) {
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

  return (
    <div className="flex flex-col items-center">
      {/* Delivery Info Header */}
      <div className="w-full bg-gray-100 rounded-xl p-4 mb-8 text-center">
        <p className="text-xl font-semibold text-gray-800">
          {formattedDate} เวลา {formattedTime} บริเวณ ตึก {displayLocation}
        </p>
      </div>

      {/* Package Icon */}
      <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-8">
        <svg className="w-20 h-20 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        </svg>
      </div>

      {/* Status Message */}
      <p className="text-xl font-semibold text-orange-500">
        ยืนยันคำสั่งซื้อแล้ว ผู้ขายกำลังเตรียมสินค้า
      </p>
    </div>
  )
}
