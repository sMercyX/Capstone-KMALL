// src/modules/StoreSellerPage/storeOrderTab/StoreOrdersTab.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SwitchTabs, { type SwitchTabItem } from "../../../components/SwitchTabs/SwitchTabs"
import { useOrderSellerApi, type OrderStatusGroup, type orderSellerResponse } from "../../../api/orderSellerApi"
import { Loader2 } from "lucide-react"
import OrderListItem, { type OrderStatusContext } from "../../../components/Order/OrderListItem"
import { getAllLocations, type CampusLocation } from "../../../api/campusLocationApi"
import { useStoreStore } from "../../../stores/storeStore"
import Pagination from "../../../components/Pagination/Pagination"

const TABS: SwitchTabItem[] = [
  { key: "active", label: "ON GOING" },
  { key: "completed", label: "COMPLETED" },
  { key: "cancelled", label: "CANCELED/FAILED" },
]

function OrderListHeader() {
  return (
    <div className="flex items-center justify-between px-6 pb-2 text-xs text-gray-400 font-light">
      <div className="w-[10%] min-w-[60px]">No.</div>
      <div className="w-[20%]">Buyer</div>
      <div className="w-[20%]">Order Date</div>
      <div className="w-[15%]">Pickup Location</div>
      <div className="w-[15%]">Total</div>
      <div className="w-[10%] text-center">Status</div>
      <div className="w-[10%]"></div>
    </div>
  )
}

export default function StoreOrdersTab() {
  const store = useStoreStore((s) => s.store)
  const storeId = store?.id
  const navigate = useNavigate()
  
  const { getOrdersSellerByStatus } = useOrderSellerApi()
  
  const [activeTab, setActiveTab] = useState<string>("active")
  const [orders, setOrders] = useState<orderSellerResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<CampusLocation[]>([])

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Load locations
  useEffect(() => {
    getAllLocations().then(setLocations).catch(console.error)
  }, [])

  // Reset page when tab changes via state instead of URL sync
  const handleTabChange = (key: string) => {
    if (key !== activeTab) {
      setActiveTab(key)
      setPage(1)
    }
  }

  // Fetch orders
  useEffect(() => {
    if (!storeId) return
    
    let isMounted = true
    setLoading(true)
    setError(null)

    getOrdersSellerByStatus(storeId, activeTab as OrderStatusGroup, 5, page)
      .then(res => {
        if (isMounted) {
            if (res.code === 200 && res.data) {
              setOrders(res.data.items || [])
              setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / (res.data.pageSize || 5))))
            } else {
              setOrders([])
              setTotalPages(1)
            }
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(err)
          setError("Failed to load orders")
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, activeTab, page])

  const getContext = (): OrderStatusContext => {
    if (activeTab === "completed") return "completed"
    if (activeTab === "cancelled") return "canceled"
    return "ongoing"
  }

  return (
    <div>
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-wide text-gray-800">
          MY ORDER{" "}
          <span
            className={
              activeTab === "active"
                ? "text-orange-400"
                : activeTab === "completed"
                ? "text-green-500"
                : "text-red-500"
            }
          >
            {activeTab === "active"
              ? "ON GOING"
              : activeTab === "completed"
              ? "COMPLETED"
              : "CANCELED"}
          </span>
        </h1>
      </div>

      <div className="mb-6">
        <SwitchTabs 
          tabs={TABS} 
          useNavLink={false}
          activeKey={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[500px]">
        <OrderListHeader />

        <div className="space-y-1 mt-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {error && <div className="text-center text-red-500 py-10">{error}</div>}

          {!loading && !error && orders.length === 0 && (
             <div className="text-center text-gray-500 py-10">No orders found</div>
          )}

          {!loading && !error && orders.map((item, idx) => (
            <OrderListItem
              key={item.order.id}
              orderId={item.order.id}
              index={(page - 1) * 5 + idx}
              date={item.order.order_date}
              totalPrice={item.order.total_price}
              status={item.order.status}
              title={item.buyer_display_name}
              locationId={item.order.campus_location_id}
              locations={locations}
              context={getContext()}
              isSeller={true}
              onClick={() => navigate(`/store/orders/${item.order.id}`)}
            />
          ))}
        </div>
        
        {!error && totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
