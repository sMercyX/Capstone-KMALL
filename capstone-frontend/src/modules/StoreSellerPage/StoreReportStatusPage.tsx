import { useState, useEffect } from "react"
import { FiSearch } from "react-icons/fi"
import { useNavigate } from "react-router-dom"
import { useReportApi, type ReportResponse } from "../../api/reportApi"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

type TabKey = "ALL" | "PENDING" | "RESOLVED" | "CLOSED"

const tabs: { label: string; key: TabKey }[] = [
  { label: "All", key: "ALL" },
  { label: "In progress", key: "PENDING" },
  { label: "The problem has been solved", key: "RESOLVED" },
  { label: "Evidence", key: "CLOSED" }
]

export default function StoreReportStatusPage() {
  const navigate = useNavigate()
  const { getReportsMe } = useReportApi()
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await getReportsMe({
        status: activeTab === "ALL" ? undefined : activeTab,
        limit,
        page,
        q: searchQuery || undefined
      })
      if (res.code === 200 && res.data) {
        setReports(res.data.items || [])
        setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / limit)))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [activeTab, page])

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPage(1)
      fetchReports()
    }
  }

  const formatDate = (isoString: string) => {
    try {
      return format(new Date(isoString), "MMMM d, yyyy")
    } catch {
      return isoString
    }
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[#8e7314] text-xs font-semibold bg-[#fad450] w-full max-w-[130px] whitespace-nowrap">
            <Loader2 className="animate-spin flex-shrink-0" size={14} />
            In progress
          </div>
        )
      case "RESOLVED":
        return (
          <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#63c063] w-full max-w-[130px] whitespace-nowrap">
            Resolved
          </div>
        )
      case "CLOSED":
        return (
          <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#f05252] w-full max-w-[130px] whitespace-nowrap">
            Evidence
          </div>
        )
      default:
        return (
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-full text-gray-700 bg-gray-200 text-sm font-medium w-full max-w-[130px] whitespace-nowrap">
            {status}
          </div>
        )
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto w-full p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="text-gray-400 text-sm mb-2 font-medium">
            Reports &gt; <span className="text-gray-600">My Report Status</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            My Report Status
          </h1>
        </div>
        <div className="relative mt-2 md:mt-6 w-full md:w-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            placeholder="Enter Report ID to Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg w-full md:w-80 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4 overflow-hidden">
        {/* Tabs inside Card */}
        <div className="flex gap-6 px-6 pt-4 border-b border-gray-100 overflow-x-auto custom-scrollbar">
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
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 bg-[#fbfaf8] border border-gray-200 rounded-lg px-6 py-4 text-sm font-medium text-gray-600 mb-3">
                <div className="col-span-2">Report ID</div>
                <div className="col-span-3">Created at</div>
                <div className="col-span-2">Order ID</div>
                <div className="col-span-3">Reason (s)</div>
                <div className="col-span-2">Status</div>
              </div>

              {/* Table Body */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-12 flex justify-center text-primary">
                    <Loader2 className="animate-spin" size={32} />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-lg bg-white">
                    No reports found.
                  </div>
                ) : (
                  reports.map((r) => (
                    <div
                      key={r.report_id}
                      className="grid grid-cols-12 gap-4 items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-[#ff5a36] cursor-pointer"
                      onClick={() => navigate(`/store/orders/${r.order_id}`)}
                    >
                      <div className="col-span-2 text-gray-800 text-sm font-medium">
                        #RPT-{r.report_id.toString().padStart(4, "0")}
                      </div>
                      <div className="col-span-3 text-gray-500 text-sm">{formatDate(r.created_at)}</div>
                      <div className="col-span-2 text-gray-500 text-sm">ORDER : #{r.order_id}</div>
                      <div className="col-span-3 text-gray-500 text-sm truncate pr-4" title={r.reason_code}>
                        {r.reason_code}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        {renderStatus(r.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 pb-4">
              <div className="flex gap-2">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium transition-colors ${
                        page === pNum
                          ? "bg-[#ff5a36] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
