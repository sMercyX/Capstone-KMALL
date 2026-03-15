import { useParams, Link } from "react-router-dom"
import { useState, useRef, useEffect } from "react"
import ProductList from "../../../components/ProductList/ProductList"
import { useReportApi, type ReportDetailResponse } from "../../../api/reportApi"
import { Loader2, X, Maximize2, User } from "lucide-react"
import { format } from "date-fns"

const formatChatDate = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return "วันนี้"
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "เมื่อวาน"
  } else {
    return format(date, "d MMM yyyy")
  }
}
import { resolveImageUrl } from "../../../utils/resolve"
// import BackButton from "../../../components/Buttons/BackButton"
import { toast } from "react-toastify"
import ResolveReportModal, { type ResolveActionData } from "../../../components/Admin/ResolveReportModal"

export default function ReportDetailPage() {
  const { type, reportId } = useParams()
  const [activeTab, setActiveTab] = useState("Report Information")
  const isScrolling = useRef(false)
  
  const { getReportDetail, actionReport } = useReportApi()
  const [reportData, setReportData] = useState<ReportDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [rejectNote, setRejectNote] = useState("")

  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const tabs = [
    "Report Information",
    "Order Snapshot",
    "Chat Conversation",
    "Evidence"
  ]

  const scrollToSection = (tab: string) => {
    setActiveTab(tab)
    isScrolling.current = true
    const element = document.getElementById(tab)
    if (element) {
      // scroll to top of the element inside the container
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // Release scroll lock after animation completes
    setTimeout(() => {
      isScrolling.current = false
    }, 800)
  }

  const fetchReport = () => {
    if (!reportId) return
    let isMounted = true
    setLoading(true)
    setError(null)
    
    getReportDetail(reportId)
      .then(res => {
        if (isMounted) {
          setReportData(res.data)
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(err)
          setError("Failed to load report details")
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
      
    return () => { isMounted = false }
  }

  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return

    const root = contentRef.current
    if (!root) return

    const observer = new IntersectionObserver((entries) => {
      if (isScrolling.current) return
      
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveTab(entry.target.id)
        }
      })
    }, {
      root: root,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    })

    tabs.forEach(tab => {
      const el = document.getElementById(tab)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    const cleanup = fetchReport()
    return cleanup
  }, [reportId])

  const handleReject = async () => {
    if (!reportId || !rejectNote.trim()) return
    setSubmittingAction(true)
    try {
      await actionReport(reportId, { action_type: "NO_ACTION", note: rejectNote.trim() })
      setIsRejectModalOpen(false)
      setRejectNote("")
      toast.success("Report rejected successfully.")
      fetchReport() // Refresh data after reject
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || "Failed to reject report.")
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleResolve = async (actionData: ResolveActionData) => {
    if (!reportId || !reportData) return
    setSubmittingAction(true)
    try {
      const payload: any = {
        action_type: actionData.action_type,
        target_user_id: reportData.report.reported_user_id,
        user_role: reportData.report.reported_party_type,
        suspend_days: actionData.suspend_days,
        is_permanent: actionData.is_permanent,
        note: actionData.note
      }
      
      // If resolving against a SELLER, pass the target_store_id
      if (reportData.report.reported_party_type === "SELLER") {
        payload.target_store_id = reportData.report.store_id
      }

      await actionReport(reportId, payload)
      toast.success("Report resolved successfully.")
      fetchReport() // Refresh data
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || "Failed to resolve report.")
    } finally {
      setSubmittingAction(false)
    }
  }

  const titlePrefix = type === "seller" ? "Reported by Seller" : "Reported by Buyer"

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Report not found"}</p>
          <Link to={`/admin/report/${type}`} className="text-orange-500 hover:underline">
            Back to Reports
          </Link>
        </div>
      </div>
    )
  }

  const { report, order_snapshot, chat_snapshots, evidences } = reportData

  return (
    <div className="p-8 mx-auto w-full h-screen flex flex-col overflow-hidden">
      {/* Breadcrumb & Title Area */}
      <div className="mb-6 flex-shrink-0 flex justify-between items-end">
        <div>
          <div className="text-gray-400! text-sm mb-2 font-medium">
            Reports &gt; <Link to={`/admin/report/${type}`} className="text-gray-400! hover:text-orange-600!">{titlePrefix}</Link> &gt; <span className="text-gray-600">Report Detail</span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Report Detail</h1>
          
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold text-gray-800">#RPT-{report.report_id.toString().padStart(4, '0')}</span>
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold inline-flex items-center ${
              report.status === "PENDING" ? "bg-[#fad450] text-[#8e7314]" :
              report.status === "RESOLVED" ? "bg-green-100 text-green-700" :
              "bg-red-100 text-red-700"
            }`}>
              {report.status}
            </div>
          </div>
        </div>

        {/* Action Buttons Section */}
        {report.status === "PENDING" && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsRejectModalOpen(true)}
              disabled={submittingAction}
              className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              REJECT
            </button>
            <button 
              onClick={() => setIsResolveModalOpen(true)}
              disabled={submittingAction}
              className="bg-[#ff5a36] hover:bg-[#e04a29] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              RESOLVE REPORT
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 px-2 flex-shrink-0 hidden sm:block">
        <div className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => scrollToSection(tab)}
              className={`py-4 px-2 font-medium text-sm relative transition-colors ${
                activeTab === tab
                  ? "text-[#ff5a36]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#ff5a36] rounded-t-lg" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Continous Content Sections */}
      <div ref={contentRef} className="flex-1 overflow-y-auto space-y-6 pb-8 pr-2 scroll-smooth">
        
        {/* Report Information */}
        <div id="Report Information" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Report Information</h2>
          
          <div className="space-y-4 text-[15px]">
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800">Report ID :</span>
              <span className="text-gray-600">#RPT-{report.report_id.toString().padStart(4, '0')}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800">Create at :</span>
              <span className="text-gray-600">{format(new Date(report.created_at), "MMMM d, yyyy HH:mm")}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800">Order ID :</span>
              <span className="text-gray-600">ORDER : #{report.order_id}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800 text-[#63c063]">Reporter :</span>
              <span className="text-[#63c063] font-medium">{type === "seller" ? (report.store_name || report.reporter_display_name) : report.reporter_display_name}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800 text-[#f05252]">Reported User :</span>
              <span className="text-[#f05252] font-medium">{type === "buyer" ? (report.store_name || report.reported_display_name) : report.reported_display_name}</span>
            </div>
            
            {/* Reason box */}
            <div className="flex items-center gap-4 pt-2">
              <span className="font-semibold text-gray-800 w-[140px]">Reason (s) :</span>
              <div className="border border-gray-200 rounded-md px-4 py-1.5 text-gray-500 text-sm bg-white whitespace-nowrap">
                {report.reason_code}
              </div>
            </div>
            
            {/* Detailed reason box */}
            <div className="flex items-start gap-4 pt-2">
              <span className="font-semibold text-gray-800 pt-2 w-[140px]">Reporting details :</span>
              <div className="border border-gray-200 rounded-md px-4 py-2 text-gray-500 text-sm bg-white flex-1 max-w-[500px] min-h-[40px]">
                {report.description || "-"}
              </div>
            </div>
          </div>
        </div>

        {/* Order Snapshot */}
        <div id="Order Snapshot" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10 pb-16">
          <ProductList
            items={(order_snapshot?.items || []) as any}
            total={order_snapshot.total_price}
            subtotal={order_snapshot.total_price}
            deliveryFee={0}
            notes=""
            showHeader={true}
            showNotes={false}
            showBreakdown={true}
          />
        </div>

        {/* Chat Conversation */}
        <div id="Chat Conversation" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Chat Conversation</h2>
          
          <div className=" mx-auto flex flex-col h-[500px] bg-[#fafbfc] rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              {chat_snapshots && chat_snapshots.length > 0 ? chat_snapshots.map((msg, i) => {
                const isReporter = msg.sender_id === report.reporter_id
                const showDateDivider = i === 0 || new Date(msg.message_created_at).toDateString() !== new Date(chat_snapshots[i - 1].message_created_at).toDateString()
                
                return (
                  <div key={i} className="mb-6">
                    {showDateDivider && (
                      <div className="flex justify-center mb-6 mt-2">
                        <span className="px-3 py-1 bg-white border border-gray-200 rounded-md text-gray-500 text-xs shadow-sm">
                          {formatChatDate(msg.message_created_at)}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex ${isReporter ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[85%] ${isReporter ? 'flex-row-reverse' : 'flex-row'}`}>
                        
                        {/* Avatar */}
                        {!isReporter && (
                          <div className="w-10 h-10 rounded-full bg-[#e4e6eb] flex-shrink-0 flex items-center justify-center text-gray-500 shadow-sm mt-1">
                            <User size={24} className="text-gray-400" />
                          </div>
                        )}
                        {isReporter && (
                          <div className="w-10 h-10 rounded-full bg-[#d5d5d5] flex-shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                            <User size={24} className="text-white" fill="currentColor" />
                          </div>
                        )}

                        {/* Message Content */}
                        <div className={`flex flex-col ${isReporter ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2.5 text-[15px] shadow-sm ${
                            isReporter 
                              ? 'bg-[#4caf50] text-white rounded-2xl rounded-tr-sm' 
                              : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
                          }`}>
                            {msg.message_type === 'IMAGE' && msg.attachment_urls && msg.attachment_urls.map((url, j) => (
                                <img 
                                  key={j} 
                                  src={resolveImageUrl(url)} 
                                  alt="Attachment" 
                                  className={`max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${msg.message_text ? 'mb-2' : ''}`}
                                  onClick={() => setSelectedImage(resolveImageUrl(url))}
                                />
                            ))}
                            {msg.message_text && <div className="leading-relaxed whitespace-pre-wrap">{msg.message_text}</div>}
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1.5 text-gray-400 text-[11px] font-medium">
                            <span>{format(new Date(msg.message_created_at), "HH:mm")}</span>
                            {isReporter && <span className="ml-0.5">✓</span>}
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="flex justify-center items-center h-full text-gray-400">
                  No chat history
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div id="Evidence" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10 min-h-[300px]">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Evidence</h2>
            <p className="text-gray-400 text-sm mt-1">uploaded by reporter</p>
          </div>
          
          {evidences && evidences.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {evidences.map((evidence, i) => (
                <div 
                  key={i} 
                  className="rounded-lg overflow-hidden border border-gray-100 cursor-pointer relative w-full h-[160px] bg-gray-50 flex items-center justify-center transition-all group"
                  onClick={() => {
                       if (evidence.mime_type.startsWith('image/')) {
                         setSelectedImage(resolveImageUrl(evidence.file_url))
                       } else {
                         window.open(resolveImageUrl(evidence.file_url), '_blank')
                       }
                  }}
                >
                  {evidence.mime_type.startsWith('image/') ? (
                    <img src={resolveImageUrl(evidence.file_url)} alt={evidence.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full p-4">
                      <span className="text-gray-400 text-sm break-all text-center uppercase font-medium">{evidence.mime_type.split('/')[1] || 'FILE'}</span>
                    </div>
                  )}
                  
                  {/* Bottom Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md text-white px-3 py-2 flex items-center justify-between transition-opacity">
                    <span className="text-sm font-medium">Evidence {i + 1}</span>
                    <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center items-center text-gray-400 py-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
               No evidence provided
            </div>
          )}
        </div>
        
      </div>

      {/* Reject Report Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-[600px] transform overflow-hidden rounded-2xl bg-white p-8 text-left shadow-xl transition-all animate-in zoom-in-95 duration-200 scale-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-900">
                Reject Report <span className="text-[#ff5a36]">[ #RPT-{report.report_id.toString().padStart(4, '0')} ]</span>
              </h3>
              <button
                onClick={() => { setIsRejectModalOpen(false); setRejectNote(""); }}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Please provide the reason for rejecting this report. This information will be recorded and shared with the reporter.
            </p>

            <hr className="border-gray-200 mb-5" />

            {/* Note textarea */}
            <div>
              <label className="text-sm font-semibold text-gray-800">
                note<span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                placeholder="หลักฐานที่แนบมาไม่ละเอียดและไม่ตรงกัน"
                className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:border-[#ff5a36] focus:outline-none focus:ring-1 focus:ring-[#ff5a36] resize-none"
              />
            </div>

            {/* Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={!rejectNote.trim() || submittingAction}
                className={`px-8 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors ${
                  rejectNote.trim() && !submittingAction
                    ? "bg-red-500 hover:bg-red-600" 
                    : "bg-gray-300 cursor-not-allowed"
                }`}
                onClick={handleReject}
              >
                {submittingAction ? "Rejecting..." : "Rejected"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ResolveReportModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        onConfirm={handleResolve}
        targetUserName={report.reported_display_name}
        targetUserRole={report.reported_party_type}
        reportId={report.report_id}
      />

      {/* Fullscreen Image Viewer Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-10 h-10" />
          </button>
          
          <img 
            src={selectedImage} 
            alt="Fullscreen View" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  )
}
