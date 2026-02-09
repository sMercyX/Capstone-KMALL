// src/modules/StoreOrderDetailPage/CompletedCanceledPage/CompletedCanceledPage.tsx
import type { OrderItemDetail, orderSellerData } from "../../../api/orderSellerApi"
import ProductList from "../components/ProductList"

interface CompletedCanceledPageProps {
  order: orderSellerData
  items: OrderItemDetail[]
  total: number
}

export default function CompletedCanceledPage({ order, items, total }: CompletedCanceledPageProps) {
  const isCancelled = order.status === "Cancelled"

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
      {/* Receipt Icon with Badge */}
      <div className="relative w-48 h-48 mb-4">
        {/* Receipt Background */}
        <div className={`w-full h-full rounded-full flex flex-col items-center justify-center ${
          isCancelled ? 'bg-gradient-to-b from-gray-400 to-gray-500' : 'bg-gradient-to-b from-cyan-400 to-cyan-500'
        }`}>
          {/* Receipt lines */}
          <div className="space-y-2">
            <div className={`w-20 h-2 rounded ${isCancelled ? 'bg-gray-300' : 'bg-cyan-300'}`}></div>
            <div className={`w-16 h-2 rounded ${isCancelled ? 'bg-gray-300' : 'bg-cyan-300'}`}></div>
            <div className={`w-14 h-2 rounded ${isCancelled ? 'bg-gray-300' : 'bg-cyan-300'}`}></div>
          </div>
        </div>
        {/* Badge */}
        <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center border-4 border-white ${
          isCancelled ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {isCancelled ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          )}
        </div>
      </div>

      {/* Status Message */}
      <p className={`text-2xl font-bold mb-2 ${isCancelled ? 'text-red-500' : 'text-green-500'}`}>
        {isCancelled ? 'Order Cancelled' : 'Order Completed'}
      </p>

      {/* Cancellation Reason */}
      {isCancelled && order.cancelled_reason && (
        <p className="text-gray-600 mb-4">
          Reason: {order.cancelled_reason}
        </p>
      )}

      {/* Order Info */}
      <div className="text-center text-gray-600 mb-8">
        <p className="text-lg">ORDER : #{order.id}</p>
        <p className="text-lg">{formattedDate} at {formattedTime}</p>
      </div>

      {/* Product List */}
      <div className="w-full">
        <ProductList items={items} total={total} />
      </div>
    </div>
  )
}
