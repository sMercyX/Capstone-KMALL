import { useEffect, useState } from "react"
import { useReportApi, type ReportResponse } from "../../api/reportApi"
import { format } from "date-fns"
import { FaChevronLeft, FaChevronRight, FaCheck, FaTimes } from "react-icons/fa"
import { FiSearch } from "react-icons/fi"
import { Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface ReportManagerProps {
  reportedPartyType: "SELLER" | "BUYER"
}

export default function ReportManager({ reportedPartyType }: ReportManagerProps) {
  const { getReports } = useReportApi()
  const navigate = useNavigate()
  
  const [pendingReports, setPendingReports] = useState<ReportResponse[]>([])
  const [secondaryReports, setSecondaryReports] = useState<ReportResponse[]>([])
  const [activeTab, setActiveTab] = useState<"RESOLVED" | "CLOSED">("RESOLVED")
  
  // Pagination State
  const [pendingPage, setPendingPage] = useState(1)
  const [pendingTotalPages, setPendingTotalPages] = useState(1)
  const [pendingTotal, setPendingTotal] = useState(0)

  const [secondaryPage, setSecondaryPage] = useState(1)
  const [secondaryTotalPages, setSecondaryTotalPages] = useState(1)
  const [secondaryTotal, setSecondaryTotal] = useState(0)

  useEffect(() => {
    fetchPending()
  }, [pendingPage, reportedPartyType])

  useEffect(() => {
    fetchSecondary()
  }, [activeTab, secondaryPage, reportedPartyType])

  async function fetchPending() {
    try {
      const res = await getReports({
        reported_party_type: reportedPartyType,
        status: "PENDING",
        limit: 4,
        page: pendingPage
      })
      if (res.code === 200 && res.data) {
        setPendingReports(res.data.items || [])
        setPendingTotal(res.data.total || 0)
        setPendingTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / (res.data.page_size || 4))))
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSecondary() {
    try {
      const res = await getReports({
        reported_party_type: reportedPartyType,
        status: activeTab,
        limit: 4,
        page: secondaryPage
      })
      if (res.code === 200 && res.data) {
        setSecondaryReports(res.data.items || [])
        setSecondaryTotal(res.data.total || 0)
        setSecondaryTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / (res.data.page_size || 4))))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const title = reportedPartyType === "SELLER" ? "Reported By Seller" : "Reported By Buyer"

  // Utility to format date
  const formatDate = (isoString: string) => {
    try {
      return format(new Date(isoString), "MMMM d, yyyy")
    } catch {
      return isoString
    }
  }

  const renderTable = (items: ReportResponse[], isPending: boolean) => {
    return (
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px] mb-2 pb-2">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 bg-[#fbfaf8] border border-gray-200 rounded-lg px-6 py-4 text-sm font-medium text-gray-600 mb-3">
            <div className="col-span-2">Report ID</div>
            <div className="col-span-2">Created at</div>
            <div className="col-span-2">Order ID</div>
            <div className="col-span-4">Reason (s)</div>
            <div className="col-span-2"></div>
          </div>

          {/* List of items */}
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="py-8 text-center text-gray-400 border border-gray-200 rounded-lg bg-white">
                No reports found.
              </div>
            ) : (
              items.map((r) => (
                <div
                  key={r.report_id}
                  onClick={() => navigate(`/admin/report/${reportedPartyType.toLowerCase()}/${r.report_id}`)}
                  className="cursor-pointer grid grid-cols-12 gap-4 items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-[#ff5a36]"
                >
                  <div className="col-span-2 text-gray-800 text-sm font-medium">
                    #RPT-{r.report_id.toString().padStart(4, "0")}
                  </div>
                  <div className="col-span-2 text-gray-500 text-sm">{formatDate(r.created_at)}</div>
                  <div className="col-span-2 text-gray-500 text-sm">ORDER : #{r.order_id}</div>
                  <div className="col-span-4 text-gray-500 text-sm truncate pr-4" title={r.reason_code}>
                    {r.reason_code}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {isPending ? (
                      <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[#8e7314] text-xs font-semibold bg-[#fad450] w-[160px] whitespace-nowrap">
                        <Loader2 className="animate-spin flex-shrink-0" size={14} />
                        Waiting for resolve
                      </div>
                    ) : activeTab === "RESOLVED" ? (
                      <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#63c063] w-[140px] whitespace-nowrap">
                        <FaCheck size={12} />
                        Resolved
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#f05252] w-[140px] whitespace-nowrap">
                        <FaTimes size={12} />
                        Rejected
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1280px] mx-auto w-full">
      {/* Breadcrumb & Title Area */}
      <div className="mb-8">
        <div className="text-gray-400 text-sm mb-2 font-medium">
          Reports &gt; <span className="text-gray-600">{title}</span>
        </div>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            {title}
            <span className="text-gray-400 text-xl font-normal">
              ({pendingTotal} Pending)
            </span>
          </h1>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FiSearch size={18} />
            </span>
            <input
              type="text"
              placeholder="Enter Report ID to Search"
              className="pl-10 pr-4 py-2 border border-white rounded-lg w-72 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-sm"
              style={{ background: "#ffffff" }}
            />
          </div>
        </div>
      </div>

      {/* Pending Reports Section */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 mb-8">
        <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-3">
          <div className="flex gap-6">
            <button className="text-primary font-semibold border-b-2 border-primary pb-3 px-1 relative top-[13px]">
              Pending Reports
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <span>{pendingTotalPages > 0 ? pendingPage : 0}/{pendingTotalPages}</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button 
                className={`px-3 py-1.5 hover:bg-gray-50 border-r border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed`} 
                disabled={pendingPage <= 1} 
                onClick={() => setPendingPage(p => p - 1)}
              >
                <FaChevronLeft className="text-gray-600" size={12} />
              </button>
              <button 
                className={`px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`} 
                disabled={pendingPage >= pendingTotalPages} 
                onClick={() => setPendingPage(p => p + 1)}
              >
                <FaChevronRight className="text-gray-600" size={12} />
              </button>
            </div>
          </div>
        </div>
        
        {renderTable(pendingReports, true)}
      </div>

      {/* Secondary Reports Section (Tabs) */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6">
        <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-3">
          <div className="flex gap-6">
            <button
              onClick={() => { setActiveTab("RESOLVED"); setSecondaryPage(1); }}
              className={`pb-3 px-1 relative top-[13px] font-semibold transition-colors ${
                activeTab === "RESOLVED"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
              }`}
            >
              Resolved Reports
            </button>
            <button
              onClick={() => { setActiveTab("CLOSED"); setSecondaryPage(1); }}
              className={`pb-3 px-1 relative top-[13px] font-semibold transition-colors ${
                activeTab === "CLOSED"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
              }`}
            >
              Rejected Report
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <span>{secondaryTotalPages > 0 ? secondaryPage : 0}/{secondaryTotalPages}</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button 
                className={`px-3 py-1.5 hover:bg-gray-50 border-r border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed`} 
                disabled={secondaryPage <= 1} 
                onClick={() => setSecondaryPage(p => p - 1)}
              >
                <FaChevronLeft className="text-gray-600" size={12} />
              </button>
              <button 
                className={`px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`} 
                disabled={secondaryPage >= secondaryTotalPages} 
                onClick={() => setSecondaryPage(p => p + 1)}
              >
                <FaChevronRight className="text-gray-600" size={12} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tab content summary */}
        {activeTab === "RESOLVED" && secondaryTotal > 0 && (
          <div className="flex items-center gap-2 mt-6 mb-2">
            <FaCheck className="text-green-500" size={20} />
            <span className="text-xl font-medium text-gray-800">{secondaryTotal} Resolved Reports</span>
          </div>
        )}
        
        {activeTab === "CLOSED" && secondaryTotal > 0 && (
          <div className="flex items-center gap-2 mt-6 mb-2">
            <FaTimes className="text-red-500" size={20} />
            <span className="text-xl font-medium text-gray-800">{secondaryTotal} Rejected Reports</span>
          </div>
        )}
        
        {renderTable(secondaryReports, false)}
      </div>
    </div>
  )
}
