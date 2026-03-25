import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { OrderItemDetail, orderSellerData, OrderDeliveryAddress } from "../../../api/orderSellerApi"
import { useProductApi, type RecommendationProduct } from "../../../api/productApi"
import { resolveImageUrl } from "../../../utils/resolve"
import ProductList from "../../../components/ProductList/ProductList"
import { MapPin, Calendar, CheckCircle2, XCircle } from "lucide-react"

interface CompletedCanceledPageProps {
  order: orderSellerData
  items: OrderItemDetail[]
  total: number
  isBuyer: boolean
  deliveryAddress?: OrderDeliveryAddress
}

export default function CompletedCanceledPage({ order, items, total, isBuyer, deliveryAddress }: CompletedCanceledPageProps) {
  const isCancelled = order.status === "Cancelled"
  const { getCancellationRecommendations } = useProductApi()

  const [recommendations, setRecommendations] = useState<RecommendationProduct[]>([])
  const [recsLoading, setRecsLoading] = useState(false)

  // Fetch recommendations for cancelled orders - only for buyer
  useEffect(() => {
    if (!isCancelled || !isBuyer) return

    const fetchRecs = async () => {
      setRecsLoading(true)
      try {
        const res = await getCancellationRecommendations(order.id)
        setRecommendations(res.data?.items ?? [])
      } catch (err) {
        console.error("Failed to fetch cancellation recommendations:", err)
      } finally {
        setRecsLoading(false)
      }
    }
    fetchRecs()
  }, [order.id, isCancelled, isBuyer])

  return (
    <div className="flex flex-col gap-6">
      {/* Delivery Info Box (for ROUND_UNIVERSITY) */}
      {order.delivery_method === "ROUND_UNIVERSITY" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          
          <div className="flex items-start gap-4 flex-1">
             <div className="bg-gray-50 p-3 rounded-xl shadow-sm border border-gray-100">
                {isCancelled ? <XCircle className="h-6 w-6 text-red-500" /> : <CheckCircle2 className="h-6 w-6 text-green-500" />}
             </div>
             <div>
                <h4 className="text-xl font-bold text-gray-900 mb-1">
                  Delivery Address
                </h4>
                <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${isCancelled ? 'text-red-600' : 'text-green-600'}`}>
                   {isCancelled ? "Order Cancelled" : "Order Delivered"}
                </p>
                {deliveryAddress && (
                   <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{deliveryAddress.label}: {deliveryAddress.address_line1}</span>
                   </div>
                )}
             </div>
          </div>

          {!isCancelled && items[0]?.promised_ship_date && (
            <div className="bg-white/60 px-6 py-4 rounded-xl border border-white flex flex-col items-center md:items-end">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Delivered on</p>
               <div className="flex items-center gap-2 text-gray-900 font-bold">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <span>
                    {new Date(items[0].promised_ship_date).toLocaleString('th-TH', { 
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </span>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Standard Completed Icon (for Meeting Method) */}
      {!isCancelled && order.delivery_method !== "ROUND_UNIVERSITY" && (
        <div className="flex flex-col items-center mb-2">
          <div className="relative w-48 h-48 mb-4">
            <div className="w-full h-full rounded-full flex flex-col items-center justify-center bg-gradient-to-b from-cyan-400 to-cyan-500">
              <div className="space-y-2">
                <div className="w-20 h-2 rounded bg-cyan-300"></div>
                <div className="w-16 h-2 rounded bg-cyan-300"></div>
                <div className="w-14 h-2 rounded bg-cyan-300"></div>
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center border-4 border-white bg-green-500">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-green-500 mb-2">Order Completed</p>
        </div>
      )}

      {/* Cancellation Reason */}
      {isCancelled && order.cancelled_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-600 mb-1">Cancellation reason</p>
          <p className="text-sm text-red-700">{order.cancelled_reason}</p>
        </div>
      )}

      {/* Product Details Table */}
      <ProductList items={items} total={total} notes={order.notes} />

      {/* Recommendation Section — only for Cancelled orders AND Buyer */}
      {isCancelled && isBuyer && (
        <div className="mt-4">
          {/* Section Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Cross-Store Product Recommendations
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            These products are similar to what you are looking for and are available for sale.
          </p>

          {/* Loading */}
          {recsLoading && (
            <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
          )}

          {/* Recommendation Grid */}
          {!recsLoading && recommendations.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.product.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Product Image */}
                  <div className="relative h-[180px] overflow-hidden">
                    <img
                      src={resolveImageUrl(rec.product.image_url)}
                      alt={rec.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">
                      {rec.product.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                      {rec.product.store_name}
                    </p>

                    {/* Price & Sold Count */}
                    <div className="flex items-end justify-between mb-3">
                      <p className="text-lg font-bold text-orange-500">
                        ฿ {rec.product.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        Sold {rec.product.sold_count ?? 0} pieces
                      </p>
                    </div>

                    {/* View Product Button */}
                    <Link
                      to={`/product/${rec.product.id}`}
                      className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white! text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      View Product
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No recommendations */}
          {!recsLoading && recommendations.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              No recommendations found at this time.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
