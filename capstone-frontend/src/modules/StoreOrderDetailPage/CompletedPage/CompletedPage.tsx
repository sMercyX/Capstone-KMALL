// src/modules/StoreOrderDetailPage/CompletedPage/CompletedPage.tsx
import type { orderSellerData } from "../../../api/orderSellerApi"

interface CompletedPageProps {
  order: orderSellerData
}

export default function CompletedPage({ order }: CompletedPageProps) {
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

      {/* Checkmark Icon */}
      <div className="w-40 h-40 bg-green-100 rounded-full flex items-center justify-center mb-8">
        <svg className="w-20 h-20 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>

      {/* Status Message */}
      <p className="text-xl font-semibold text-green-600">
        ดำเนินการเสร็จสิ้น
      </p>
    </div>
  )
}
