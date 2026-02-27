import { useEffect, useState } from "react"
import { useReportApi, type ReportResponse } from "../../api/reportApi"
import { format } from "date-fns"
import { FaChevronLeft, FaChevronRight, FaCheck, FaTimes } from "react-icons/fa"
import { FiSearch } from "react-icons/fi"

interface ReportManagerProps {
  reportedPartyType: "SELLER" | "BUYER"
}

export default function ReportManager({ reportedPartyType }: ReportManagerProps) {
  const { getReports } = useReportApi()
  
  const [pendingReports, setPendingReports] = useState<ReportResponse[]>([])
  const [secondaryReports, setSecondaryReports] = useState<ReportResponse[]>([])
  const [activeTab, setActiveTab] = useState<"RESOLVED" | "CLOSED">("RESOLVED")
  
  // Pagination State
  const [pendingPage, setPendingPage] = useState(1)
  const [secondaryPage, setSecondaryPage] = useState(1)

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
        limit: 10,
        page: pendingPage
      })
      if (res.code === 200) {
        setPendingReports(res.data || [])
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
        limit: 10,
        page: secondaryPage
      })
      if (res.code === 200) {
        setSecondaryReports(res.data || [])
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
      <div className="mt-4">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-4 bg-[#fbfaf8] border border-gray-200 rounded-lg px-6 py-4 text-sm font-medium text-gray-600 mb-3">
          <div className="col-span-2">Report ID</div>
          <div className="col-span-3">Created at</div>
          <div className="col-span-2">Order ID</div>
          <div className="col-span-3">Reason (s)</div>
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
                className="grid grid-cols-12 gap-4 items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-gray-300"
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
                  {isPending ? (
                    <button className="bg-[#ff5a36] hover:bg-[#e04a29] text-white px-5 py-2 rounded-md font-medium text-sm transition-colors w-full max-w-[130px]">
                      View Detail
                    </button>
                  ) : activeTab === "RESOLVED" ? (
                    <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#63c063] w-full max-w-[130px]">
                      <FaCheck size={12} />
                      Resolved
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium bg-[#f05252] w-full max-w-[130px]">
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
              ({pendingReports.length} Pending)
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
            <span>1/7</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button className="px-3 py-1.5 hover:bg-gray-50 border-r border-gray-200" disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)}>
                <FaChevronLeft className="text-gray-400" size={12} />
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50" onClick={() => setPendingPage(p => p + 1)}>
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
            <span>1/7</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button className="px-3 py-1.5 hover:bg-gray-50 border-r border-gray-200" disabled={secondaryPage === 1} onClick={() => setSecondaryPage(p => p - 1)}>
                <FaChevronLeft className="text-gray-400" size={12} />
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50" onClick={() => setSecondaryPage(p => p + 1)}>
                <FaChevronRight className="text-gray-600" size={12} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tab content summary */}
        {activeTab === "RESOLVED" && secondaryReports.length > 0 && (
          <div className="flex items-center gap-2 mt-6 mb-2">
            <FaCheck className="text-green-500" size={20} />
            <span className="text-xl font-medium text-gray-800">{secondaryReports.length} Resolved Reports</span>
          </div>
        )}
        
        {renderTable(secondaryReports, false)}
      </div>
    </div>
  )
}
