import type { OrderItemDetail, orderSellerData, OrderDeliveryAddress } from "../../../api/orderSellerApi"
import ProductList from "../../../components/ProductList/ProductList"
import { MapPin, Calendar } from "lucide-react"

interface OutOfDeliveryPageProps {
  order: orderSellerData
  items: OrderItemDetail[]
  subtotal: number
  deliveryFee: number
  total: number
  locationName?: string
  viewMode: "buyer" | "seller"
  deliveryAddress?: OrderDeliveryAddress
}

export default function OutOfDeliveryPage({ order, items, subtotal, deliveryFee, total, locationName, viewMode, deliveryAddress  }: OutOfDeliveryPageProps) {
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
      ? (order.delivery_method === "ROUND_UNIVERSITY" ? "The seller is out for delivery to your location." : "The seller is on the way to the meeting point.")
      : (order.delivery_method === "ROUND_UNIVERSITY" ? "Are you out for delivery to the destination?" : "Have you arrived at the meeting point?")

  return (
    <div className="flex flex-col items-center">
      {/* Delivery Info Header */}
      <div className="w-full bg-white rounded-xl p-4 mb-2 text-left">
        {order.delivery_method === "ROUND_UNIVERSITY" ? (
          <div className="flex flex-col items-start w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">
               Delivery Address
            </h3>
            <div className="w-full bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-start gap-4">
               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex-shrink-0">
                  <MapPin className="h-6 w-6 text-gray-500" />
               </div>
               <div className="flex-1 pt-0.5">
                  <div className="flex flex-col gap-1.5">
                     <p className="text-sm font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Scheduled Delivery
                     </p>
                     <p className="text-xl font-bold text-gray-900">
                        {items[0]?.promised_ship_date ? (
                          new Date(items[0].promised_ship_date).toLocaleString('th-TH', { 
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        ) : "Date Pending"}
                     </p>
                     <div className="h-px bg-gray-100 my-1 w-full" />
                     <p className="text-gray-600 font-medium">
                       {deliveryAddress ? `${deliveryAddress.label}: ${deliveryAddress.address_line1}` : "No Address"}
                     </p>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <p className="text-xl font-semibold text-gray-800">
            {formattedDate} at {formattedTime} · Building {displayLocation}
          </p>
        )}
      </div>

      {/* Delivery Truck Icon */}
      <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-8">
        <svg className="w-20 h-20 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      </div>

      {/* Status Message */}
      <p className="text-xl font-semibold text-orange-500 mb-8">{statusText}</p>

      {/* Product Details Section */}
      <div className="w-full mb-6">
        <h3 className="text-xl font-bold mb-4">Product details</h3>
        <ProductList
          items={items}
          total={total}
          notes={order.notes}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          showHeader={false}
          showNotes={true}
          showBreakdown={true}
        />
      </div>
    </div>
  )
}
