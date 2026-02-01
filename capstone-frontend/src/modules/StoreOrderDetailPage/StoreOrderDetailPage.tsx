// src/pages/store/StoreOrderDetailPage.tsx
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Store } from "lucide-react"
import { IoChevronBack } from "react-icons/io5"

import {
  useOrderSellerApi,
  type OrderDetailResponse,
  type OrderStatus,
} from "../../api/orderSellerApi"
import { useUserStore } from "../../stores/userStore"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { handleApiError } from "../../utils/handleApiError"
import { getZones, getLocationsByZone, getAllLocations, type CampusLocation } from "../../api/campusLocationApi"
import PendingProposedPage from "./PendingProposedPage/PendingProposedPage"
import AcceptedPage from "./AcceptedPage/AcceptedPage"
import OutOfDeliveryPage from "./OutOfDeliveryPage/OutOfDeliveryPage"
import ArrivedPage from "./ArrivedPage/ArrivedPage"
import CompletedCanceledPage from "./CompletedCanceledPage/CompletedCanceledPage"

type StepKey = "PENDING" | "PROPOSED" | "ACCEPTED" | "OUT_FOR_DELIVERY" | "ARRIVED" | "DONE"

const STEPS: { key: StepKey; label: string }[] = [
  { key: "PENDING", label: "PENDING" },
  { key: "PROPOSED", label: "PROPOSED" },
  { key: "ACCEPTED", label: "ACCEPTED" },
  { key: "OUT_FOR_DELIVERY", label: "OUT FOR DELIVERY" },
  { key: "ARRIVED", label: "ARRIVED" },
  { key: "DONE", label: "COMPLETED" },
]

function getStepIndex(status: string): number {
  switch (status) {
    case "Pending Seller Confirmation":
    case "Pending":
      return 0
    case "Proposed":
    case "Awaiting Buyer Confirmation":
      return 1
    case "Accepted":
      return 2
    case "Out For Delivery":
      return 3
    case "Arrived":
      return 4
    case "Completed":
    case "Cancelled":
      return 5
    default:
      return 0
  }
}

function getStepLabel(stepKey: StepKey, currentStatus?: string): string {
  switch (stepKey) {
    case "PENDING":
      return "PENDING"
    case "PROPOSED":
      return "PROPOSED"
    case "ACCEPTED":
      return "ACCEPTED"
    case "OUT_FOR_DELIVERY":
      return "OUT FOR DELIVERY"
    case "ARRIVED":
      return "ARRIVED"
    case "DONE":
      if (currentStatus === "Cancelled") return "CANCELED"
      return "COMPLETED"
    default:
      return ""
  }
}

function formatThaiDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-"
  const d = typeof date === "string" ? new Date(date) : date
  
  // Convert to Thai Buddhist year
  const thaiYear = d.getFullYear() + 543
  const day = d.getDate()
  const month = d.getMonth() + 1
  const hours = d.getHours().toString().padStart(2, "0")
  const minutes = d.getMinutes().toString().padStart(2, "0")
  
  return `${day}/${month}/${thaiYear} ${hours}:${minutes} น.`
}

export default function StoreOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { getOrderDetail, updateOrderStatus, cancelledOrder, proposeOrder, acceptOrder } =
    useOrderSellerApi()
  const { name: userName } = useUserStore()
  const navigate = useNavigate()

  const [data, setData] = useState<OrderDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<
    "accept" | "reject" | null
  >(null)

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  // Delivery editing states
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null)
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>("10:00 AM")
  const [meetingNoteInput, setMeetingNoteInput] = useState("")
  const [proposeLoading, setProposeLoading] = useState(false)
  
  // Display states
  const [meetingLocationName, setMeetingLocationName] = useState("")

  // Zone and building data from API
  const [zones, setZones] = useState<string[]>([])
  const [buildings, setBuildings] = useState<CampusLocation[]>([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [loadingBuildings, setLoadingBuildings] = useState(false)

  // Fetch zones on mount
  useEffect(() => {
    const fetchZones = async () => {
      try {
        setLoadingZones(true)
        const zonesData = await getZones()
        setZones(zonesData)
      } catch (e) {
        console.error('Failed to fetch zones:', e)
      } finally {
        setLoadingZones(false)
      }
    }
    fetchZones()
  }, [])

  // Populate dropdowns when order data is loaded
  useEffect(() => {
    const populateDropdowns = async () => {
      const order = data?.order

      if (!order) return

      // If order has a meeting location, populate the dropdowns
      if (order.meeting_location_id || order.campus_location_id) {
        try {
          const locationId = order.meeting_location_id || order.campus_location_id
          // 1. Fetch ALL locations to find the zone of the meeting location
          const allLocations = await getAllLocations()
          const location = allLocations.find(loc => loc.id === locationId)
          
          if (location) {
            // Set display name
            setMeetingLocationName(location.name)

            // 2. Set selected Zone
            setSelectedZone(location.zone)
            
            // 3. Set selected Building
            // But since we have all locations, we can set buildings immediately for better UX
            // Filter buildings for this zone
            const zoneBuildings = allLocations.filter(loc => loc.zone === location.zone)
            setBuildings(zoneBuildings)
            setSelectedBuilding(location.id)
          } else {
             setMeetingLocationName(`${locationId}`)
          }
        } catch (e) {
          console.error('Failed to fetch location details:', e)
        }
      }
      
      // If order has proposed_at, populate date and time
      if (order.proposed_at) {
        const proposedDate = new Date(order.proposed_at)
        setSelectedDateTime(proposedDate)
        
        // Format time to "HH:mm" or "HH:mm AM/PM" depending on what DateTimePicker expects
        // For time part string:
        const hours = proposedDate.getHours()
        const minutes = proposedDate.getMinutes()
        const ampm = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes
        const timeString = `${displayHours}:${displayMinutes} ${ampm}`
        
        setSelectedTime(timeString)
      }
      
      // Populate meeting note
      if (order.meeting_note) {
        setMeetingNoteInput(order.meeting_note)
      }
    }

    if (data?.order) {
      populateDropdowns()
    }
  }, [data])

  // Fetch buildings when zone changes
  useEffect(() => {
    const fetchBuildings = async () => {
      if (!selectedZone) {
        // Only clear buildings if we aren't currently viewing a proposed order with correct data
        // Check if the current selected building exists in current buildings list
        // If it does, we assume it's correctly set by the populate useEffect
        // Actually, safer to check if user manually changed zone
        return
      }
      
      // If we already have buildings for this zone (e.g. from populate logic), skip fetch
      if (buildings.length > 0 && buildings[0].zone === selectedZone) {
        return
      }

      try {
        setLoadingBuildings(true)
        const locationsData = await getLocationsByZone(selectedZone)
        setBuildings(locationsData)
      } catch (e) {
        console.error('Failed to fetch buildings:', e)
        setBuildings([])
      } finally {
        setLoadingBuildings(false)
      }
    }
    fetchBuildings()
  }, [selectedZone])

  // Handle zone change - reset building when zone changes
  const handleZoneChange = (zoneId: string | null) => {
    // Only clear selected building if zone literally changes to something else
    if (zoneId !== selectedZone) {
       setSelectedBuilding(null)
       // Clear buildings so useEffect refetches for new zone
       setBuildings([]) 
    }
    setSelectedZone(zoneId)
  }

  // Handle propose order
  async function handleProposeOrder() {
    if (!orderId || !selectedDateTime) return
    
    try {
      setProposeLoading(true)
      
      // Parse time and combine with date
      const timeParts = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (timeParts) {
        let hours = parseInt(timeParts[1])
        const minutes = parseInt(timeParts[2])
        const isPM = timeParts[3].toUpperCase() === "PM"
        
        if (isPM && hours !== 12) hours += 12
        if (!isPM && hours === 12) hours = 0
        
        selectedDateTime.setHours(hours, minutes, 0, 0)
      }
      
      await proposeOrder(
        parseInt(orderId),
        selectedDateTime.toISOString(),
        selectedBuilding || undefined,
        meetingNoteInput || undefined
      )
      
      toast.success("เสนอวันเวลาสำเร็จ!")
      
      // Refresh data
      const res = await getOrderDetail(parseInt(orderId))
      setData(res.data)
    } catch (err) {
      handleApiError(err)
    } finally {
      setProposeLoading(false)
    }
  }

  useEffect(() => {
    if (!orderId) return

    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await getOrderDetail(Number(orderId))
        setData(res.data ?? null)
      } catch {
        setError("ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้")
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  // Access control: check if current user has permission to view this order
  // - /store/orders/:id → check seller_name
  // - /orders/:id → check buyer_name
  useEffect(() => {
    if (!loading && data && userName) {
      const isSellerPath = window.location.pathname.includes('/store/orders/')
      
      if (isSellerPath) {
        // Seller must match seller_name
        if (data.seller_name !== userName) {
          toast.error("คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้")
          navigate("/dashboard")
        }
      } else {
        // Buyer must match buyer_name
        if (data.buyer_name !== userName) {
          toast.error("คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้")
          navigate("/dashboard")
        }
      }
    }
  }, [data, userName, loading, navigate])

  const order = data?.order
  const items = data?.items ?? []
  const store_name = data?.store_name

  const currentStep = order ? getStepIndex(order.status) : 0
  const isSellerPath = typeof window !== 'undefined' && window.location.pathname.includes('/store/orders/')
  const isBuyer = !isSellerPath  // Buyer view is /orders/:id, Seller view is /store/orders/:id
  const isFinished = order?.status === "Completed" || order?.status === "Cancelled"

  // Buyer: no buttons after PROPOSED status
  // Seller: has buttons throughout the order lifecycle
  const canReject = !!order && !isFinished && (isSellerPath || order.status === "Proposed")
  
  // Accept button visibility:
  // - PENDING (Seller): propose order
  // - PROPOSED (Buyer): accept proposal
  // - ACCEPTED (Seller): move to Out For Delivery
  // - OUT_FOR_DELIVERY (Seller): move to Arrived
  // - ARRIVED (Seller): move to Completed
  const canAccept = !!order && !isFinished && (
    (order.status === "Pending" && isSellerPath) || 
    (order.status === "Proposed" && !isSellerPath) ||
    (order.status === "Accepted" && isSellerPath) ||
    (order.status === "Out For Delivery" && isSellerPath) ||
    (order.status === "Arrived" && isSellerPath)
  )

  // Return to order list button - show when order is finished
  const canReturnToOrder = !!order && isFinished

  const handleRejectClick = () => {
    if (!order || !orderId || !canReject) return
    setCancelReason("")
    setIsRejectModalOpen(true)
  }

  const confirmReject = async () => {
    if (!order || !orderId) return
    setActionLoading("reject")
    setError(null)
    try {
      await cancelledOrder(order.id, cancelReason)
      setData((prev) =>
        prev
          ? {
              ...prev,
              order: { ...prev.order, status: "Cancelled", cancelled_reason: cancelReason },
            }
          : prev
      )
      setIsRejectModalOpen(false)
      toast.success("ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว")
    } catch (e) {
      handleApiError(e)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptClick = () => {
    if (!order || !orderId || !canAccept) return
    setIsAcceptModalOpen(true)
  }

  const handleAccept = async () => {
    if (!order || !orderId || !canAccept) return
    setIsAcceptModalOpen(false)
    
    // If status is PENDING, call proposeOrder to move to PROPOSED
    if (order.status === "Pending") {
      // Validate required fields
      if (!selectedZone || !selectedBuilding || !selectedDateTime) {
        toast.error("กรุณาเลือก Zone, อาคาร และวันเวลานัดรับสินค้า")
        return
      }
      
      setActionLoading("accept")
      setError(null)
      
      try {
        // Parse time and combine with date
        const dateTime = new Date(selectedDateTime)
        const timeParts = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
        if (timeParts) {
          let hours = parseInt(timeParts[1])
          const minutes = parseInt(timeParts[2])
          const isPM = timeParts[3].toUpperCase() === "PM"
          
          if (isPM && hours !== 12) hours += 12
          if (!isPM && hours === 12) hours = 0
          
          dateTime.setHours(hours, minutes, 0, 0)
        }
        
        await proposeOrder(
          parseInt(orderId),
          dateTime.toISOString(),
          selectedBuilding,
          meetingNoteInput || undefined
        )
        
        // Refresh data
        const res = await getOrderDetail(parseInt(orderId))
        setData(res.data)
        
        toast.success("เสนอรายละเอียดการนัดรับสำเร็จ!")
      } catch (e) {
        handleApiError(e)
      } finally {
        setActionLoading(null)
      }
      return
    }
    
    // If status is PROPOSED, buyer calls acceptOrder
    if (order.status === "Proposed") {
      setActionLoading("accept")
      setError(null)
      
      try {
        await acceptOrder(parseInt(orderId))
        
        // Refresh data
        const res = await getOrderDetail(parseInt(orderId))
        setData(res.data)
        
        toast.success("ยืนยันรับสินค้าสำเร็จ!")
      } catch (e) {
        handleApiError(e)
      } finally {
        setActionLoading(null)
      }
      return
    }
    
    // For other statuses (Accepted, Out for delivery, Arrived), use updateOrderStatus to move to next status
    // Status flow: Accepted → Out For Delivery → Arrived → Completed
    let nextStatus = ""
    let successMessage = ""
    
    switch (order.status) {
      case "Accepted":
        nextStatus = "Out For Delivery"
        successMessage = "เปลี่ยนสถานะเป็น กำลังจัดส่ง"
        break
      case "Out For Delivery":
        nextStatus = "Arrived"
        successMessage = "เปลี่ยนสถานะเป็น ถึงจุดนัดพบแล้ว"
        break
      case "Arrived":
        nextStatus = "Completed"
        successMessage = "คำสั่งซื้อเสร็จสมบูรณ์!"
        break
      default:
        return
    }
    
    setActionLoading("accept")
    setError(null)
    try {
      await updateOrderStatus(order.id, {
        status: nextStatus as OrderStatus,
      })

      // Refresh data
      const res = await getOrderDetail(parseInt(orderId))
      setData(res.data)
      
      toast.success(successMessage)
    } catch (e) {
      handleApiError(e)
    } finally {
      setActionLoading(null)
    }
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const deliveryFee = 0
  const total = subtotal + deliveryFee

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Back Button */}
      <button
        onClick={() => navigate(isSellerPath ? '/store/orders' : '/orders/ongoing')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <IoChevronBack className="w-6 h-6" />
        <span className="text-base font-medium">กลับ</span>
      </button>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          ข้อมูลการสั่งซื้อ
        </h1>
        <div className="inline-block bg-black text-white px-6 py-2 rounded-lg">
          <p className="text-base md:text-lg font-semibold tracking-wider">
            ORDER : #{orderId}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex justify-center">
        <div className="w-full max-w-4xl rounded-3xl bg-white border border-gray-200 px-6 md:px-8 py-6">
          <div className="relative">
            <div className="absolute top-4 left-[8.33%] right-[8.33%] h-[2px] bg-gray-300" />
            <div className="relative flex justify-between">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentStep
                const isPassed = idx < currentStep
                return (
                  <div
                    key={step.key}
                    className="flex-1 flex flex-col items-center text-[10px] md:text-xs z-10"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold
            ${
              isActive
                ? "border-black bg-black text-white"
                : isPassed
                ? "border-gray-400 bg-gray-400 text-white"
                : "border-gray-300 bg-white text-gray-400"
            }`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`mt-2 uppercase text-[9px] md:text-[10px] tracking-tight whitespace-nowrap font-medium ${
                        isActive ? "text-black font-bold" : "text-gray-400"
                      }`}
                    >
                      {getStepLabel(step.key, order?.status)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-3xl bg-white border border-gray-200 px-6 md:px-8 py-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Store className="h-5 w-5 text-gray-700" />
            </div>
            <Link to={`/store/${order?.store_id}`}>
              <span className="font-semibold text-gray-900 hover:text-gray-700">
                {store_name}
              </span>
            </Link>
          </div>
          <button className="text-sm font-semibold text-gray-700 hover:text-black">
            Chat
          </button>
        </div>

        {/* Timestamp */}
        {order?.order_date && (
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              {formatThaiDateTime(order.order_date)}
            </p>
          </div>
        )}

        <hr className="border-gray-200 mb-6" />

        {loading && (
          <p className="text-center text-sm text-gray-500 py-8">กำลังโหลด...</p>
        )}
        {error && <p className="text-center text-sm text-red-500 py-8">{error}</p>}

        {order && !loading && !error && (
          <>
            {/* PendingProposedPage - Only for Pending/Proposed status */}
            {(order.status === "Pending" || order.status === "Proposed") && (
              <PendingProposedPage
                items={items}
                order={order}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                total={total}
                buyerDisplayName={data?.buyer?.display_name}
                zones={zones}
                buildings={buildings}
                selectedZone={selectedZone}
                selectedBuilding={selectedBuilding}
                selectedDateTime={selectedDateTime}
                selectedTime={selectedTime}
                meetingNoteInput={meetingNoteInput}
                isBuyer={isBuyer}
                proposeLoading={proposeLoading}
                onZoneChange={handleZoneChange}
                onBuildingChange={setSelectedBuilding}
                onDateTimeChange={(date, time) => {
                  setSelectedDateTime(date)
                  setSelectedTime(time)
                }}
                onMeetingNoteChange={setMeetingNoteInput}
                onProposeOrder={handleProposeOrder}
              />
            )}

            {/* Accepted Status Page */}
            {order.status === "Accepted" && (
              <AcceptedPage order={order} locationName={meetingLocationName} />
            )}

            {/* Out for Delivery Page */}
            {order.status === "Out For Delivery" && (
              <OutOfDeliveryPage order={order} locationName={meetingLocationName} />
            )}

            {/* Arrived Page */}
            {order.status === "Arrived" && (
              <ArrivedPage order={order} locationName={meetingLocationName} />
            )}

            {/* Completed/Cancelled Page */}
            {(order.status === "Completed" || order.status === "Cancelled") && (
              <CompletedCanceledPage order={order} items={items} total={total} />
            )}
          </>
        )}
      </div>

      {/* Action Buttons - Outside the card */}
      {order && !isFinished && (canAccept || canReject) && (
        <div className="flex justify-center gap-4 mt-8 mb-8">
          {canAccept && (
            <button
              onClick={handleAcceptClick}
              disabled={actionLoading === "accept"}
              className={`px-16 py-3 rounded-lg text-base font-semibold text-white transition-colors
                ${
                  actionLoading === "accept"
                    ? "bg-green-300 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600"
                }`}
            >
              {actionLoading === "accept" ? "กำลังยืนยัน..." : "Accept"}
            </button>
          )}

          {canReject && (
            <button
              onClick={handleRejectClick}
              disabled={actionLoading === "reject"}
              className={`px-16 py-3 rounded-lg text-base font-semibold text-white transition-colors
                ${
                  actionLoading === "reject"
                    ? "bg-red-300 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600"
                }`}
            >
              {actionLoading === "reject" ? "กำลังยกเลิก..." : "Reject"}
            </button>
          )}
        </div>
      )}

      {/* Return to Order List Button - Show when order is finished */}
      {canReturnToOrder && (
        <div className="flex justify-center mt-8 mb-8">
          <button
            onClick={() => navigate(isSellerPath ? `/store/orders` : '/orders/ongoing')}
            className="px-16 py-3 rounded-lg text-base font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {isSellerPath ? 'กลับหน้าร้าน' : 'กลับหน้ารายการ'}
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={confirmReject}
        title="ยืนยันการยกเลิก"
        message="คุณต้องการที่จะยกเลิกจริงๆ ใช่ไหม?"
        confirmText="ยืนยัน"
        cancelText="ยกเลิก"
        variant="danger"
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            ระบุเหตุผล (ถ้ามี)
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            rows={3}
            placeholder="เช่น สินค้าหมด, ไม่สามารถจัดส่งได้"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        onConfirm={handleAccept}
        title="ยืนยันการดำเนินการ"
        message={order?.status === "Pending" 
          ? "คุณต้องการเสนอวันเวลานัดรับหรือไม่?" 
          : order?.status === "Proposed"
          ? "คุณต้องการยืนยันรับข้อเสนอนี้หรือไม่?"
          : order?.status === "Accepted"
          ? "คุณต้องการเปลี่ยนสถานะเป็น \"กำลังจัดส่ง\" หรือไม่?"
          : order?.status === "Out For Delivery"
          ? "คุณต้องการเปลี่ยนสถานะเป็น \"ถึงจุดนัดพบ\" หรือไม่?"
          : "คุณต้องการเปลี่ยนสถานะเป็น \"เสร็จสมบูรณ์\" หรือไม?"}
        confirmText="ยืนยัน"
        cancelText="ยกเลิก"
        variant="info"
      />
    </div>
  )
}