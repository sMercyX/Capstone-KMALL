import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useOrderSellerApi, type OrderStatusGroup, type orderSellerResponse } from "../../../api/orderSellerApi"
import { Loader2, Search } from "lucide-react"
import { getAllLocations, type CampusLocation } from "../../../api/campusLocationApi"
import { useStoreStore } from "../../../stores/storeStore"
import { format, parseISO } from "date-fns"
import SearchInput from "../../../components/Admin/SearchInput"
import OrderStatusLabel from "../../../components/Order/OrderStatusLabel"

type TabKey = "active" | "completed" | "cancelled"

const tabs: { label: string; key: TabKey }[] = [
  { label: "On Going", key: "active" },
  { label: "Completed", key: "completed" },
  { label: "Canceled/Failed", key: "cancelled" }
]

export default function StoreOrdersTab() {
  const store = useStoreStore((s) => s.store)
  const storeId = store?.id
  const navigate = useNavigate()
  
  const { getOrdersSellerByStatus } = useOrderSellerApi()
  
  const [activeTab, setActiveTab] = useState<TabKey>("active")
  const [orders, setOrders] = useState<orderSellerResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<CampusLocation[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [searchQueryDebounced, setSearchQueryDebounced] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 5

  // Load locations
  useEffect(() => {
    getAllLocations().then(setLocations).catch(console.error)
  }, [])

  // Fetch orders
  useEffect(() => {
    if (!storeId) return
    
    setLoading(true)
    getOrdersSellerByStatus(storeId, activeTab as OrderStatusGroup, limit, page, searchQueryDebounced)
      .then(res => {
        if (res.code === 200 && res.data) {
          setOrders(res.data.items || [])
          setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / limit)))
        } else {
          setOrders([])
          setTotalPages(1)
        }
      })
      .catch(err => {
        console.error(err)
        setOrders([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [storeId, activeTab, page, searchQueryDebounced])

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setSearchQueryDebounced(searchQuery)
      setPage(1)
    }
  }



  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="text-gray-400 text-sm mb-2 font-medium">
            Orders &gt; <span className="text-gray-600">Order Management</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Order Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage and track all customer orders and their current status.
          </p>
        </div>
        <SearchInput
          placeholder="Enter Order ID or Buyer Name"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value
            setSearchQuery(val)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              setSearchQueryDebounced(val)
              setPage(1)
            }, 400)
          }}
          onKeyDown={handleSearch}
          containerClassName="mt-2 md:mt-6 w-full md:w-80"
        />
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4 overflow-hidden">
        {/* Tabs inside Card */}
        <div className="flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex gap-6 pt-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  setPage(1)
                }}
                className={`pb-4 px-1 whitespace-nowrap font-medium text-sm transition-colors border-b-2 relative top-[1px] ${
                  activeTab === tab.key
                    ? "text-[#ff5a36] border-[#ff5a36]"
                    : "text-gray-400 border-transparent hover:text-gray-600 cursor-pointer"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Top Pagination */}
          {totalPages > 0 && (
            <div className="flex items-center gap-4 pt-1">
              <span className="text-sm font-bold text-gray-800">
                <span className="text-[#ff5a36]">{page}</span>
                <span className="text-gray-300 mx-1">/</span>
                <span className="text-gray-400">{totalPages}</span>
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                >
                  <span className="text-lg">&lt;</span>
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                >
                  <span className="text-lg">&gt;</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 bg-[#fbfaf8] border border-gray-200 rounded-lg px-6 py-4 text-sm font-medium text-gray-600 mb-3">
                <div className="col-span-1">Order ID</div>
                <div className="col-span-2">Buyer Name</div>
                <div className="col-span-2">Order Date / Time</div>
                <div className="col-span-3">Pickup Location</div>
                <div className="col-span-1">Total Amount</div>
                <div className="col-span-2 text-center">Order Status</div>
                <div className="col-span-1 text-center"></div>
              </div>

              {/* Table Body */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-12 flex justify-center text-[#ff5a36]">
                    <Loader2 className="animate-spin" size={32} />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-lg bg-white">
                    No orders found.
                  </div>
                ) : (
                  orders.map((item) => {
                    const loc = locations.find(l => l.id === item.order.campus_location_id)
                    return (
                      <div
                        key={item.order.id}
                        onClick={() => navigate(`/store/orders/${item.order.id}`)}
                        className="grid grid-cols-12 gap-4 items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#ff5a36] group cursor-pointer"
                      >
                        <div className="col-span-1 flex items-center">
                           <span className="text-gray-400 text-sm font-bold">#{item.order.id}</span>
                        </div>
                        <div 
                           className="col-span-2 text-gray-800 text-sm font-bold truncate group-hover:text-[#ff5a36]"
                        >
                          {item.buyer_display_name}
                        </div>
                        <div className="col-span-2 text-gray-500 text-sm italic">
                          {item.order.proposed_at ? format(parseISO(item.order.proposed_at), "dd MMM yyyy, p") : "-"}
                        </div>
                        <div className="col-span-3 text-gray-600 text-sm truncate pr-4" title={loc?.name || "-"}>
                          {loc?.name || "-"}
                        </div>
                        <div className="col-span-1 text-gray-800 text-sm text-center font-bold">
                          {item.order.total_price.toLocaleString()} ฿
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-6">
                          <OrderStatusLabel status={item.order.status} className="w-full max-w-[130px]" />
                         
                        </div>
                        <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/store/orders/${item.order.id}/chat`);
                            }}
                            className="text-gray-900 text-sm font-bold hover:text-[#ff5a36] underline underline-offset-4 cursor-pointer"
                          >
                            Chat
                          </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
