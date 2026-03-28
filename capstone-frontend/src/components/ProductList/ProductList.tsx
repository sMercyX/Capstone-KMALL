import { Store } from "lucide-react"
import type { OrderItemDetail } from "../../api/orderSellerApi"
import { resolveImageUrl } from "../../utils/resolve"

interface ProductListProps {
  items: OrderItemDetail[]
  total: number
  notes?: string
  subtotal?: number
  deliveryFee?: number
  showHeader?: boolean
  showNotes?: boolean
  showBreakdown?: boolean
}

export default function ProductList({ 
  items, 
  total, 
  subtotal,
  deliveryFee,
  showHeader = true,
  showBreakdown = false,
}: ProductListProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
      {/* Header */}
      {showHeader && (
        <h3 className="text-lg font-bold mb-4">Product details</h3>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 md:gap-4 mb-4 text-xs md:text-sm text-gray-500">
        <div className="col-span-1 text-center">No.</div>
        <div className="col-span-6 md:col-span-7">Product</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-3 md:col-span-2 text-right">Price</div>
      </div>

      {/* Table Body */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.order_item_id}
            className={`grid grid-cols-12 gap-2 md:gap-4 items-center rounded-lg p-3 ${index % 2 === 0 ? 'bg-orange-50' : 'bg-white'}`}
          >
            <div className="col-span-1 text-center text-sm font-medium">
              {index + 1}.
            </div>
            <div className="col-span-6 md:col-span-7 flex items-center gap-3">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                {item.product_image_url ? (
                  <img
                    src={resolveImageUrl(item.product_image_url)}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-300">
                    <Store className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {item.product_name}
                </p>
                {item.variant_label && (
                  <p className="text-xs text-orange-600 font-medium bg-orange-50 py-0.5 rounded-full w-fit mt-1">
                    {item.variant_label}
                  </p>
                )}
              </div>
            </div>
            <div className="col-span-2 flex justify-center">
              <span className="inline-flex items-center justify-center bg-orange-500 text-white text-xs font-bold rounded-md px-3 py-1 min-w-[2rem]">
                {item.quantity}
              </span>
            </div>
            <div className="col-span-3 md:col-span-2 text-right">
              <p className="text-sm font-medium text-gray-900">
                ฿ {item.subtotal.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">
            No items found.
          </p>
        )}
      </div>


      {/* Price Breakdown */}
      {showBreakdown && subtotal !== undefined && deliveryFee !== undefined && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">฿ {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery fee</span>
            <span className="font-medium">฿ {deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base md:text-lg font-bold pt-3 border-t border-gray-300">
            <span>Grand total</span>
            <span className="text-orange-500">฿ {total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Simple Total (when no breakdown) */}
      {!showBreakdown && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
          <span className="text-lg font-bold">Grand total</span>
          <span className="text-xl font-bold text-orange-500">฿ {total.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
