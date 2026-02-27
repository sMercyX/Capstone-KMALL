import { useParams, Link } from "react-router-dom"
import { useState, useRef, useEffect } from "react"

export default function ReportDetailPage() {
  const { type, reportId } = useParams()
  const [activeTab, setActiveTab] = useState("Report Information")
  const isScrolling = useRef(false)

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

  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
      rootMargin: "-10% 0px -80% 0px", // triggers when element reaches top 10%
      threshold: 0
    })

    tabs.forEach(tab => {
      const el = document.getElementById(tab)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  // Placeholder data for the mockup
  const mockReport = {
    reportId: reportId ? `#RPT-${reportId.padStart(4, "0")}` : "#RPT-1000",
    createdAt: "July 1, 2024",
    orderId: "ORDER : #1111",
    reporter: "Handmade_SHOP",
    reportedUser: "NITCHAN KONKIT",
    reason: "Buyer fails to show up / defaults on order",
    details: "The buyer didn't show up at the meeting point and we've been waiting for an hour.",
    status: "Pending Reports"
  }

  const titlePrefix = type === "seller" ? "Reported by Seller" : "Reported by Buyer"

  return (
    <div className="p-8 max-w-[1280px] mx-auto w-full h-screen flex flex-col overflow-hidden">
      {/* Breadcrumb & Title Area */}
      <div className="mb-6 flex-shrink-0">
        <div className="text-gray-400 text-sm mb-2 font-medium">
          Reports &gt; <Link to={`/admin/report/${type}`} className="hover:text-gray-600 transition-colors">{titlePrefix}</Link> &gt; <span className="text-gray-600">Report Detail</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Report Detail</h1>
        
        <div className="flex items-center gap-4">
          <span className="text-2xl font-semibold text-gray-800">{mockReport.reportId}</span>
          <div className="bg-[#fad450] text-[#8e7314] px-4 py-1.5 rounded-full text-sm font-semibold inline-flex items-center">
            {mockReport.status}
          </div>
        </div>
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
              <span className="text-gray-600">{mockReport.reportId}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800">Create at :</span>
              <span className="text-gray-600">{mockReport.createdAt}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800">Order ID :</span>
              <span className="text-gray-600">{mockReport.orderId}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800 text-[#63c063]">Reporter :</span>
              <span className="text-[#63c063] font-medium">{mockReport.reporter}</span>
            </div>
            
            <div className="grid grid-cols-[140px_1fr]">
              <span className="font-semibold text-gray-800 text-[#f05252]">Reported User :</span>
              <span className="text-[#f05252] font-medium">{mockReport.reportedUser}</span>
            </div>
            
            {/* Reason box */}
            <div className="flex items-center gap-4 pt-2">
              <span className="font-semibold text-gray-800 w-[140px]">Reason (s) :</span>
              <div className="border border-gray-200 rounded-md px-4 py-1.5 text-gray-500 text-sm bg-white whitespace-nowrap">
                {mockReport.reason}
              </div>
            </div>
            
            {/* Detailed reason box */}
            <div className="flex items-start gap-4 pt-2">
              <span className="font-semibold text-gray-800 pt-2 w-[140px]">Reporting details :</span>
              <div className="border border-gray-200 rounded-md px-4 py-2 text-gray-500 text-sm bg-white flex-1 max-w-[500px] min-h-[40px]">
                {mockReport.details}
              </div>
            </div>
          </div>
        </div>

        {/* Order Snapshot */}
        <div id="Order Snapshot" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Snapshot</h2>
          
          <div className="grid grid-cols-[80px_1fr_100px_120px_1fr] text-sm text-gray-400 mb-4 px-4 font-medium">
            <div>ลำดับ</div>
            <div>ชื่อสินค้า</div>
            <div className="text-center">จำนวน</div>
            <div>ราคา</div>
            <div>หมายเหตุ</div>
          </div>

          <div className="space-y-3 mb-8">
            {/* Item 1 */}
            <div className="grid grid-cols-[80px_1fr_100px_120px_1fr] items-center bg-[#fff8f7] rounded-xl px-4 py-3 text-sm">
              <div className="text-gray-700">1.</div>
              <div className="flex items-center gap-4 bg-[#fff8f7]">
                <div className="w-10 h-10 bg-gray-200 rounded-md overflow-hidden bg-[#fff8f7]">
                  <img src="https://placehold.co/40x40/ddd/ddd" alt="Product" className="w-full h-full object-cover" />
                </div>
                <span className="font-medium text-gray-800">กำไลข้อมือ</span>
              </div>
              <div className="flex justify-center bg-[#fff8f7]">
                <span className="bg-[#ff5a36] text-white px-3 py-1 rounded text-xs font-medium">2</span>
              </div>
              <div className="text-gray-700 bg-[#fff8f7]">78 บาท</div>
              <div className="text-gray-600 bg-[#fff8f7]">เอาโทนชมพู</div>
            </div>
            
            {/* Item 2 */}
            <div className="grid grid-cols-[80px_1fr_100px_120px_1fr] items-center bg-[#fff8f7] rounded-xl px-4 py-3 text-sm">
              <div className="text-gray-700">2.</div>
              <div className="flex items-center gap-4 bg-[#fff8f7]">
                <div className="w-10 h-10 bg-gray-200 rounded-md overflow-hidden bg-[#fff8f7]">
                  <img src="https://placehold.co/40x40/ddd/ddd" alt="Product" className="w-full h-full object-cover" />
                </div>
                <span className="font-medium text-gray-800">สร้อยคอ</span>
              </div>
              <div className="flex justify-center bg-[#fff8f7]">
                 <span className="bg-[#ff5a36] text-white px-3 py-1 rounded text-xs font-medium">1</span>
              </div>
              <div className="text-gray-700 bg-[#fff8f7]">45 บาท</div>
              <div className="text-gray-600 bg-[#fff8f7]">เอาสีโทนธรรมชาติ ๆ</div>
            </div>

            {/* Item 3 */}
            <div className="grid grid-cols-[80px_1fr_100px_120px_1fr] items-center bg-[#fff8f7] rounded-xl px-4 py-3 text-sm">
              <div className="text-gray-700">3.</div>
              <div className="flex items-center gap-4 bg-[#fff8f7]">
                <div className="w-10 h-10 bg-gray-200 rounded-md overflow-hidden bg-[#fff8f7]">
                  <img src="https://placehold.co/40x40/ddd/ddd" alt="Product" className="w-full h-full object-cover" />
                </div>
                <span className="font-medium text-gray-800">แหวน</span>
              </div>
              <div className="flex justify-center bg-[#fff8f7]">
                 <span className="bg-[#ff5a36] text-white px-3 py-1 rounded text-xs font-medium">1</span>
              </div>
              <div className="text-gray-700 bg-[#fff8f7]">39 บาท</div>
              <div className="text-gray-600 bg-[#fff8f7]">-</div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Subtotal</span>
              <span>฿ 162</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium pb-2">
              <span>Delivery fee</span>
              <span>-</span>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between font-bold">
                <span className="text-xl text-gray-900">Grand total</span>
                <span className="text-xl text-[#ff5a36]">฿ 162</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Conversation */}
        <div id="Chat Conversation" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Chat Conversation</h2>
          
          <div className="max-w-[600px] mx-auto border border-[#ffb1a3] rounded-md flex flex-col h-[500px] bg-[#f8f9fa] overflow-hidden">
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col pt-6">
              <div className="flex justify-center mb-6">
                <span className="bg-white px-4 py-1 rounded-full text-[11px] text-gray-500 font-medium shadow-sm">วันนี้</span>
              </div>

              {/* Right Msg 1 */}
              <div className="flex justify-end mb-4">
                <div className="flex gap-2 items-end max-w-[80%]">
                  <div className="bg-[#51b655] text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm relative shadow-sm">
                    เปลี่ยนเวลาเป็น 16:00 ได้ไหมค่ะ <span className="text-[10px] ml-2 text-white/80">08:30 ✓✓</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gray-300 flex-shrink-0 grid place-items-center text-white">
                    <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                </div>
              </div>

              {/* Left Msg */}
              <div className="flex justify-start mb-6">
                <div className="flex gap-2 items-start max-w-[80%]">
                  <div className="w-9 h-9 rounded-full bg-gray-300 flex-shrink-0 overflow-hidden">
                     <img src="https://placehold.co/36x36/ddd/ddd" alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-white text-gray-700 px-4 py-2 rounded-2xl rounded-tl-none text-sm relative shadow-sm">
                    ได้ค่ะ <span className="text-[10px] ml-2 text-gray-400">15:22</span>
                  </div>
                </div>
              </div>

              {/* Right Msgs */}
              <div className="flex flex-col gap-2 items-end">
                {[
                  {text: "หนูถึงจุดนัดรับแล้วค่ะ", time: "09:11"},
                  {text: "พี่ยุไหนแล้วคะ ??", time: "09:43"},
                  {text: "ไม่มาหรอคะ ไม่ส่งหรือว่ายังไงตะ รอมา 1 ชั่วโมงแล้วค่ะ", time: "09:43"},
                  {text: "หนูขอ report การกระทำนี้นะคะ", time: "09:43"}
                ].map((msg, i) => (
                  <div key={i} className="flex gap-2 items-end max-w-[80%]">
                    <div className="bg-[#51b655] text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm relative shadow-sm">
                      {msg.text} <span className="text-[10px] ml-2 text-white/80">{msg.time} ✓✓</span>
                    </div>
                    {i === 0 || i === 1 || i === 2 || i === 3 ? (
                      <div className="w-9 h-9 rounded-full bg-gray-300 flex-shrink-0 grid place-items-center text-white">
                        <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      </div>
                    ) : (
                      <div className="w-9 h-9" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <div className="bg-white border-t border-[#ffb1a3] p-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-400">
                <span className="text-xl leading-none mt-[-2px]">+</span>
              </div>
              <div className="flex-1 h-9 rounded-full border border-gray-300 bg-[#f9fafb]"></div>
              <div className="w-6 h-6 text-gray-300 transform -rotate-45">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div id="Evidence" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 pt-10 min-h-[300px]">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Evidence</h2>
          <div className="flex justify-center items-center text-gray-400 py-20">
             [Evidence Placeholder]
          </div>
        </div>
        
      </div>
    </div>
  )
}
