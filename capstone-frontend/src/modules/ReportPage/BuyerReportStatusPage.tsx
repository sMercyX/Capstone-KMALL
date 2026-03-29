import { useState, useEffect } from "react"
import { FaCheck, FaTimes } from "react-icons/fa"
import { Loader2 } from "lucide-react"
import SearchInput from "../../components/Input/SearchInput"
import SwitchTabs, { type SwitchTabItem } from "../../components/SwitchTabs/SwitchTabs"
import { format } from "date-fns"
import { useReportApi, type ReportResponse, type MyReportAdminAction } from "../../api/reportApi"
import ReportResultModal from "../../components/Modal/ReportResultModal"

type TabKey = "ALL" | "PENDING" | "RESOLVED" | "CLOSED"

const tabs: SwitchTabItem[] = [
  { label: "All", key: "ALL" },
  { label: "In Progress", key: "PENDING" },
  { label: "Resolved", key: "RESOLVED" },
  { label: "Rejected", key: "CLOSED" }
]

export default function BuyerReportStatusPage() {
  const { getReportsMe, getMyReportDetail } = useReportApi()
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search query
  useEffect(() => {
    setIsSearching(true)
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1) // Reset to first page on search
      setIsSearching(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportResponse | null>(null)
  const [adminActions, setAdminActions] = useState<MyReportAdminAction[]>([])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await getReportsMe({
        status: activeTab === "ALL" ? undefined : activeTab,
        limit,
        page,
        q: debouncedQuery || undefined
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
  }, [activeTab, page, debouncedQuery])


  const handleRowClick = async (report: ReportResponse) => {
    if (report.status !== "RESOLVED" && report.status !== "CLOSED") return

    setSelectedReport(report)
    setModalOpen(true)
    setModalLoading(true)
    setAdminActions([])

    try {
      const res = await getMyReportDetail(report.report_id)
      if (res.code === 200 && res.data?.admin_actions) {
        setAdminActions(res.data.admin_actions)
      }
    } catch (err) {
      console.error("Failed to load report detail:", err)
    } finally {
      setModalLoading(false)
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
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[#8e7314] text-xs font-semibold bg-[#fad450] w-[120px] whitespace-nowrap">
            <Loader2 className="animate-spin flex-shrink-0" size={14} />
            In progress
          </div>
        )
      case "RESOLVED":
        return (
          <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-xs font-medium bg-[#63c063] w-[120px] whitespace-nowrap">
            <FaCheck size={12} />
            Resolved
          </div>
        )
      case "CLOSED":
        return (
          <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-xs font-medium bg-[#f05252] w-[120px] whitespace-nowrap">
            <FaTimes size={12} />
            Rejected
          </div>
        )
      default:
        return (
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-full text-gray-700 bg-gray-200 text-xs font-medium w-[120px] whitespace-nowrap">
            {status}
          </div>
        )
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 relative">
      {/* Title */}
      <h1 className="text-center text-3xl md:text-4xl font-extrabold tracking-wide text-gray-800 mb-6">
        MY REPORT STATUS
      </h1>

      {/* Tabs */}
      <SwitchTabs
        tabs={tabs}
        useNavLink={false}
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k as TabKey)
          setPage(1)
        }}
        className="mb-6"
      />

      {/* Main Container */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          Click to view report details
        </h2>
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by report ID or reason..."
          isSearching={isSearching}
          containerClassName="w-full md:w-72"
        />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[500px] flex flex-col overflow-hidden">

        {/* Table Content */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-2 text-xs text-gray-400 font-light border-b border-gray-100 mb-4">
              <div className="w-[15%]">Report ID</div>
              <div className="w-[20%]">Created at</div>
              <div className="w-[15%]">Order ID</div>
              <div className="w-[30%]">Reason (s)</div>
              <div className="w-[20%] text-center">Status</div>
            </div>

            {/* List */}
            <div className="space-y-1 mt-2 flex-1 relative">
              {loading ? (
                <div className="py-12 flex justify-center text-primary">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : reports.length === 0 ? (
                <div className="py-12 text-center text-gray-400 border border-gray-100 rounded-xl bg-gray-50/50">
                  No reports found.
                </div>
              ) : (
                reports.map((r: ReportResponse) => {
                  const isClickable = r.status === "RESOLVED" || r.status === "CLOSED"
                  return (
                    <div
                      key={r.report_id}
                      className={`flex items-center justify-between text-sm py-4 px-6 border border-gray-100 bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors ${
                        isClickable
                          ? "hover:border-[#ff5a36] hover:bg-white cursor-pointer"
                          : ""
                      }`}
                      onClick={() => isClickable && handleRowClick(r)}
                    >
                      <div className="w-[15%] text-gray-800 font-medium">
                        #RPT-{r.report_id.toString().padStart(4, "0")}
                      </div>
                      <div className="w-[20%] text-gray-800 text-xs">
                        {formatDate(r.created_at)}
                      </div>
                      <div className="w-[15%] text-gray-800 text-xs truncate">
                        ORDER : #{r.order_id}
                      </div>
                      <div className="w-[30%] text-gray-500 text-xs truncate pr-4" title={r.reason_code}>
                        {r.reason_code}
                      </div>
                      <div className="w-[20%] flex justify-center">
                        {renderStatus(r.status)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 pb-2">
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

      {/* Report Result Modal */}
      {selectedReport && (
        <ReportResultModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedReport(null) }}
          reportId={selectedReport.report_id}
          status={selectedReport.status as "RESOLVED" | "CLOSED"}
          adminActions={adminActions}
          loading={modalLoading}
        />
      )}
    </div>
  )
}
