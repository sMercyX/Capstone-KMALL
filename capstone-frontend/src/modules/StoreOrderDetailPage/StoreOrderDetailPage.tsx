// src/pages/store/StoreOrderDetailPage.tsx
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Store } from "lucide-react"

import {
  useOrderSellerApi,
  type OrderDetailResponse,
} from "../../api/orderSellerApi"
import { useUserStore } from "../../stores/userStore"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { handleApiError } from "../../utils/handleApiError"

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
    case "Awaiting Buyer Confirmation":
      return 1
    case "Accepted":
      return 2
    case "Out for delivery":
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
  const { getOrderDetail, updateOrderStatus, cancelledOrder } =
    useOrderSellerApi()
  const { id } = useUserStore()

  const [data, setData] = useState<OrderDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<
    "accept" | "reject" | null
  >(null)

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

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

  const order = data?.order
  const items = data?.items ?? []
  const store_name = data?.store_name

  const currentStep = order ? getStepIndex(order.status) : 0
  const isBuyer = id === order?.user_id
  const isFinished = order?.status === "Completed" || order?.status === "Cancelled"

  const canReject = !!order && !isFinished
  const canAccept = !!order && !isFinished && !isBuyer

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

  const handleAccept = async () => {
    if (!order || !orderId || !canAccept) return
    setActionLoading("accept")
    setError(null)
    try {
      await updateOrderStatus(order.id, {
        status: "Completed",
      })

      setData((prev) =>
        prev
          ? {
              ...prev,
              order: { ...prev.order, status: "Completed" },
            }
          : prev
      )
      toast.success("ยืนยันคำสั่งซื้อเรียบร้อยแล้ว")
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
            {/* Order Items Section */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4">รายละเอียดสินค้า</h3>
              
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 md:gap-4 mb-4 text-xs md:text-sm text-gray-500">
                  <div className="col-span-1 text-center">ลำดับ</div>
                  <div className="col-span-6 md:col-span-7">ชื่อสินค้า</div>
                  <div className="col-span-2 text-center">จำนวน</div>
                  <div className="col-span-3 md:col-span-2 text-right">ราคา</div>
                </div>

                {/* Table Body */}
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.order_item_id}
                      className="grid grid-cols-12 gap-2 md:gap-4 items-center bg-orange-50 rounded-lg p-3"
                    >
                      <div className="col-span-1 text-center text-sm font-medium">
                        {index + 1}.
                      </div>
                      <div className="col-span-6 md:col-span-7 flex items-center gap-3">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-300">
                              <Store className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </p>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <span className="inline-flex items-center justify-center bg-orange-500 text-white text-xs font-bold rounded-md px-3 py-1 min-w-[2rem]">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="col-span-3 md:col-span-2 text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {item.subtotal.toLocaleString()} บาท
                        </p>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">
                      ยังไม่มีข้อมูลสินค้า
                    </p>
                  )}
                </div>

                {/* Notes Section */}
                <div className="mt-6">
                  <p className="text-sm font-semibold mb-2">หมายเหตุ</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 min-h-[60px]">
                    <p className="text-sm text-gray-600">
                      {order.notes || "ไม่มีหมายเหตุ"}
                    </p>
                  </div>
                </div>

                {/* Price Summary */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">รวมการสั่งซื้อ</span>
                    <span className="font-medium">{subtotal.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ค่าจัดส่งเพิ่มเติม</span>
                    <span className="font-medium">{deliveryFee.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between text-base md:text-lg font-bold pt-3 border-t border-gray-300">
                    <span>ยอดชำระทั้งหมด</span>
                    <span className="text-orange-500">{total.toLocaleString()} บาท</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mt-8">
              {!isBuyer && (
                <button
                  onClick={handleAccept}
                  disabled={!canAccept || actionLoading === "accept"}
                  className={`px-16 py-3 rounded-lg text-base font-semibold text-white transition-colors
                    ${
                      !canAccept || actionLoading === "accept"
                        ? "bg-green-300 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                >
                  {actionLoading === "accept" ? "กำลังยืนยัน..." : "Accept"}
                </button>
              )}

              <button
                onClick={handleRejectClick}
                disabled={!canReject || actionLoading === "reject"}
                className={`px-16 py-3 rounded-lg text-base font-semibold text-white transition-colors
                  ${
                    !canReject || actionLoading === "reject"
                      ? "bg-red-300 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
              >
                {actionLoading === "reject" ? "กำลังยกเลิก..." : "Reject"}
              </button>
            </div>
          </>
        )}
      </div>

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
    </div>
  )
}