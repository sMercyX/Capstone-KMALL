import { useEffect, useState, useCallback, useRef } from "react"
import { useReportApi, type ReportResponse } from "../../api/reportApi"
import { format } from "date-fns"
import { FaChevronLeft, FaChevronRight, FaCheck, FaTimes } from "react-icons/fa"
import { FiSearch } from "react-icons/fi"
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

  // Search State
  const [pendingSearch, setPendingSearch] = useState("")
  const [pendingSearchDebounced, setPendingSearchDebounced] = useState("")
  const [secondarySearch, setSecondarySearch] = useState("")
  const [secondarySearchDebounced, setSecondarySearchDebounced] = useState("")

  const pendingDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const secondaryDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handlePendingSearch = useCallback((value: string) => {
    setPendingSearch(value)
    if (pendingDebounceRef.current) clearTimeout(pendingDebounceRef.current)
    pendingDebounceRef.current = setTimeout(() => {
      setPendingSearchDebounced(value)
      setPendingPage(1)
    }, 400)
  }, [])

  const handleSecondarySearch = useCallback((value: string) => {
    setSecondarySearch(value)
    if (secondaryDebounceRef.current) clearTimeout(secondaryDebounceRef.current)
    secondaryDebounceRef.current = setTimeout(() => {
      setSecondarySearchDebounced(value)
      setSecondaryPage(1)
    }, 400)
  }, [])

  useEffect(() => {
    fetchPending()
  }, [pendingPage, reportedPartyType, pendingSearchDebounced])

  useEffect(() => {
    fetchSecondary()
  }, [activeTab, secondaryPage, reportedPartyType, secondarySearchDebounced])

  async function fetchPending() {
    try {
      const res = await getReports({
        reported_party_type: reportedPartyType,
        status: "PENDING",
        limit: 4,
        page: pendingPage,
        ...(pendingSearchDebounced ? { q: pendingSearchDebounced } : {})
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
        page: secondaryPage,
        ...(secondarySearchDebounced ? { q: secondarySearchDebounced } : {})
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

  const title = reportedPartyType === "SELLER" ? "Reported By Buyer" : "Reported By Seller"
  // Route path is opposite of reportedPartyType (SELLER reported → buyer page route, BUYER reported → seller page route)
  const routeParty = reportedPartyType === "SELLER" ? "buyer" : "seller"

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
                  onClick={() => navigate(`/admin/report/${routeParty}/${r.report_id}`)}
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
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[#d97706] whitespace-nowrap">
                        <span className="text-yellow-500">●</span>
                        Pending Review
                      </div>
                    ) : activeTab === "RESOLVED" ? (
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 whitespace-nowrap">
                        <FaCheck className="text-green-500" size={12} />
                        Resolved
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 whitespace-nowrap">
                        <span className="text-red-500">⊘</span>
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
    <div className="p-8 mx-auto w-full">
      {/* Breadcrumb & Title Area */}
      <div className="mb-8">
        <div className="text-gray-400 text-sm mb-2 font-medium">
          Reports &gt; <span className="text-gray-600">{title}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {title}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage reports submitted by {reportedPartyType === "SELLER" ? "buyers" : "sellers"}. Review pending cases and take appropriate action.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#FFF3E0] flex items-center justify-center text-lg">📋</div>
          <div>
            <div className="text-xl font-bold text-gray-800">{pendingTotal} Pending Reports</div>
            <div className="text-xs text-gray-400">(Action Required)</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center"><FaCheck className="text-green-500" size={18} /></div>
          <div>
            <div className="text-xl font-bold text-gray-800">{secondaryTotal} {activeTab === "RESOLVED" ? "Resolved" : "Rejected"}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#FFEBEE] flex items-center justify-center"><FaTimes className="text-red-500" size={18} /></div>
          <div>
            <div className="text-xl font-bold text-gray-800">{activeTab !== "RESOLVED" ? secondaryTotal : 0} Rejected</div>
          </div>
        </div>
      </div>

      {/* Search bar for Pending */}
      <div className="flex justify-end mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            value={pendingSearch}
            onChange={(e) => handlePendingSearch(e.target.value)}
            placeholder="Search by Report ID or Order ID"
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-80 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-sm bg-white"
          />
        </div>
      </div>

      {/* Pending Reports Section */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-500 text-lg">🟡</span>
              <h2 className="text-xl font-bold text-gray-900">Pending Reports</h2>
            </div>
            <p className="text-gray-400 text-sm">Reports waiting for admin review and action.</p>
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

      {/* Search bar for Secondary */}
      <div className="flex justify-end mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            value={secondarySearch}
            onChange={(e) => handleSecondarySearch(e.target.value)}
            placeholder="Search by Report ID or Order ID"
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-80 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-sm bg-white"
          />
        </div>
      </div>

      {/* Secondary Reports Section (Tabs) */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-6">
        <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-3">
          <div className="flex gap-6">
            <button
              onClick={() => { setActiveTab("RESOLVED"); setSecondaryPage(1); setSecondarySearch(""); setSecondarySearchDebounced(""); }}
              className={`pb-3 px-1 relative top-[13px] font-semibold transition-colors ${
                activeTab === "RESOLVED"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
              }`}
            >
              Resolved Reports
            </button>
            <button
              onClick={() => { setActiveTab("CLOSED"); setSecondaryPage(1); setSecondarySearch(""); setSecondarySearchDebounced(""); }}
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
        {activeTab === "RESOLVED" && (
          <div className="flex items-center gap-2 mt-6 mb-1">
            <FaCheck className="text-green-500" size={20} />
            <span className="text-xl font-bold text-gray-900">Resolved Reports</span>
          </div>
        )}
        
        {activeTab === "CLOSED" && (
          <div className="flex items-center gap-2 mt-6 mb-1">
            <FaTimes className="text-red-500" size={20} />
            <span className="text-xl font-bold text-gray-900">Rejected Report</span>
          </div>
        )}
        <p className="text-gray-400 text-sm mb-2">Reports that have been reviewed and finalized by the admin.</p>
        
        {renderTable(secondaryReports, false)}
      </div>
    </div>
  )
}
