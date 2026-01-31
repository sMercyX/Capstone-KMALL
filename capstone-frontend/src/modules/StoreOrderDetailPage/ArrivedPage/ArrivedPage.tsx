// src/modules/StoreOrderDetailPage/ArrivedPage/ArrivedPage.tsx
import type { orderSellerData } from "../../../api/orderSellerApi"

interface ArrivedPageProps {
  order: orderSellerData
}

export default function ArrivedPage({ order }: ArrivedPageProps) {
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

  return (
    <div className="flex flex-col items-center">
      {/* Delivery Info Header */}
      <div className="w-full bg-gray-100 rounded-xl p-4 mb-8 text-center">
        <p className="text-xl font-semibold text-gray-800">
          {formattedDate} เวลา {formattedTime} บริเวณ ตึก {order.campus_detail_note || '--'}
        </p>
      </div>

      {/* Location Pin Icon */}
      <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-8">
        <svg className="w-20 h-20 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>

      {/* Status Message */}
      <p className="text-xl font-semibold text-orange-500">
        ผู้ขายมาถึงจุดนัดพบแล้ว
      </p>
    </div>
  )
}
