import { useState, useEffect } from "react"
import { FiSearch } from "react-icons/fi"
import { Loader2 } from "lucide-react"
import { useBlacklistApi, type BlacklistItem } from "../../../api/blacklistApi"
import { format } from "date-fns"
import { MdBlockFlipped } from "react-icons/md"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"

type TabKey = "ALL" | "WARNING" | "TEMPORARY" | "PERMANENT"

const tabs: { label: string; key: TabKey }[] = [
  { label: "All", key: "ALL" },
  { label: "Warning", key: "WARNING" },
  { label: "Temporary", key: "TEMPORARY" },
  { label: "Permanent", key: "PERMANENT" }
]

export default function BlacklistedBuyersPage() {
  const navigate = useNavigate()
  const { getBlacklist, revokeBlacklist } = useBlacklistApi()
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [items, setItems] = useState<BlacklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BlacklistItem | null>(null)
  const limit = 20

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await getBlacklist({
        user_role: "BUYER",
        is_active: true,
        ban_type: activeTab === "ALL" ? undefined : activeTab,
        limit,
        page,
        q: searchQuery || undefined
      })
      if (res.code === 200) {
        setItems(res.data.items || [])
        setTotalPages(Math.ceil((res.data.total || 0) / limit))
      }
    } catch (err) {
      console.error("Failed to fetch blacklist:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, page])

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPage(1)
      fetchData()
    }
  }

  const handleRemove = async () => {
    if (!selectedItem) return
    try {
      await revokeBlacklist(selectedItem.user_id, selectedItem.blacklist_id)
      toast.success("Removed from blacklist successfully.")
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || "Failed to remove from blacklist.")
    }
  }

  const formatDate = (iso: string) => {
    try { return format(new Date(iso), "MMM d") } catch { return iso }
  }

  const renderPenalty = (ban_type: string) => {
    switch (ban_type) {
      case "WARNING":
        return <span className="text-[#ff5a36] font-medium text-sm">Warning</span>
      case "TEMPORARY":
        return <span className="text-[#ff5a36] font-medium text-sm">Temporary</span>
      case "PERMANENT":
        return <span className="text-[#ff5a36] font-medium text-sm">Permanent</span>
      default:
        return <span className="text-gray-500 text-sm">{ban_type}</span>
    }
  }

  const renderStatus = (item: BlacklistItem) => {
    if (item.ban_type === "TEMPORARY" && item.banned_until) {
      const now = new Date()
      const until = new Date(item.banned_until)
      if (now > until) {
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 w-[80px]">
            Expired
          </span>
        )
      }
    }
    return (
      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white w-[80px]">
        Active
      </span>
    )
  }

  const renderPeriod = (item: BlacklistItem) => {
    if (!item.banned_from) return "—"
    const from = formatDate(item.banned_from)
    if (item.banned_until) {
      const until = formatDate(item.banned_until)
      return `${from} – ${until}`
    }
    return from
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <p className="text-sm text-gray-400 mb-1">
        Blacklist &gt; <span className="font-semibold text-gray-600">Blacklisted Buyers</span>
      </p>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Blacklisted Buyers</h1>
      <p className="text-sm text-gray-400 mb-6">
        Buyers that received enforcement actions after being reported by sellers.
      </p>

      {/* Search */}
      <div className="flex justify-end mb-4">
        <div className="relative w-[280px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Name and Report ID"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#ff5a36]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      {/* White container */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6">
        {/* Tabs + Pagination */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1) }}
                className={`px-5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "text-[#ff5a36] border-b-2 border-[#ff5a36]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{page}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
              >
                ‹
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px] mb-2 pb-2">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 bg-[#fbfaf8] border border-gray-200 rounded-lg px-6 py-4 text-sm font-medium text-gray-600 mb-3">
              <div className="col-span-2">Related Report</div>
              <div className="col-span-2">Blacklisted Buyer</div>
              <div className="col-span-2">Penalty</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Penalty Period</div>
              <div className="col-span-3"></div>
            </div>

            {/* List of items */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12 border border-gray-200 rounded-lg bg-white">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm border border-gray-200 rounded-lg bg-white">
                  No blacklisted buyers found.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.blacklist_id}
                    onClick={() => navigate(`/admin/report/seller/${item.report_id}`)}
                    className="cursor-pointer grid grid-cols-12 gap-4 items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-[#ff5a36]"
                  >
                    <div className="col-span-2 text-sm text-gray-800 font-medium">
                      #RPT-{item.report_id.toString().padStart(4, "0")}
                    </div>
                    <div className="col-span-2 text-sm text-gray-500 truncate" title={item.display_name}>
                      {item.display_name}
                    </div>
                    <div className="col-span-2">
                      {renderPenalty(item.ban_type)}
                    </div>
                    <div className="col-span-1">
                      {renderStatus(item)}
                    </div>
                    <div className="col-span-2 text-sm text-gray-500">
                      {renderPeriod(item)}
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setConfirmOpen(true) }}
                        className="inline-flex items-center gap-1.5 text-sm text-[#ff5a36] hover:text-[#e04e2d] font-medium transition-colors cursor-pointer"
                      >
                        <MdBlockFlipped className="w-4 h-4" />
                        Remove from Blacklist
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelectedItem(null) }}
        onConfirm={handleRemove}
        title="Remove from Blacklist"
        message={`Are you sure you want to remove "${selectedItem?.display_name}" from the blacklist? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
