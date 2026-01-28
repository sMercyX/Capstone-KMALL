// src/pages/store/StoreOrderDetailPage.tsx
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Store } from "lucide-react"

import {
  useOrderSellerApi,
  type OrderDetailResponse,
} from "../../api/orderSellerApi"

type StepKey = "PENDING" | "PROPOSED" | "ACCEPTED" | "OUT_FOR_DELIVERY" | "ARRIVED" | "DONE"

const STEPS: { key: StepKey; label: string }[] = [
  { key: "PENDING", label: "PENDING" },
  { key: "PROPOSED", label: "PROPOSED" },
  { key: "ACCEPTED", label: "ACCEPTED" },
  { key: "OUT_FOR_DELIVERY", label: "OUT FOR DELIVERY" },
  { key: "ARRIVED", label: "ARRIVED" },
  { key: "DONE", label: "COMPLETED" }, // label สุดท้ายจะเปลี่ยนตาม status จริงด้านล่าง
]

function getStepIndex(status: string): number {
  switch (status) {
    case "Pending Seller Confirmation":
      return 0 // PENDING

    case "Awaiting Buyer Confirmation":
      return 1 // PROPOSED

    case "Accepted":
      return 2 // ACCEPTED

    case "Out for delivery":
      return 3 // OUT_FOR_DELIVERY

    case "Arrived":
      return 4 // ARRIVED

    case "Completed":
    case "Cancelled":
      return 5 // DONE (Completed/Cancelled)

    default:
      return 0
  }
}

function getStepLabel(stepKey: StepKey, currentStatus?: string): string {
  switch (stepKey) {
    case "PENDING":
      return "PENDING";
    case "PROPOSED":
      return "PROPOSED";
    case "ACCEPTED":
      return "ACCEPTED";
    case "OUT_FOR_DELIVERY":
      return "OUT FOR DELIVERY";
    case "ARRIVED":
      return "ARRIVED";
    case "DONE":
      // ถ้า status จริงเป็น Cancelled → เปลี่ยนคำบน stepper เป็น CANCELED
      if (currentStatus === "Cancelled") return "CANCELED";
      return "COMPLETED";
    default:
      return "";
  }
}


import { useUserStore } from "../../stores/userStore"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { handleApiError } from "../../utils/handleApiError"
// ... (existing imports)

// ... (existing code)

export default function StoreOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { getOrderDetail, updateOrderStatus, cancelledOrder } =
    useOrderSellerApi()
  const { id } = useUserStore()

  const [data, setData] = useState<OrderDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // state สำหรับกดปุ่ม Accept / Reject
  const [actionLoading, setActionLoading] = useState<
    "accept" | "reject" | null
  >(null)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)

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
// ... (existing code)

  const order = data?.order
  // const buyer = data?.buyer
  const items = data?.items ?? []
  const buyer_name = data?.buyer_name
  // const seller_name = data?.seller_name
  const store_name = data?.store_name

  const currentStep = order ? getStepIndex(order.status) : 0

  // อนุญาตให้กดปุ่มก็ต่อเมื่อยังไม่ Completed / Cancelled
  const isBuyer = id === order?.user_id
  const isFinished = order?.status === "Completed" || order?.status === "Cancelled"

  const canReject = !!order && !isFinished
  const canAccept = !!order && !isFinished && !isBuyer

  // ---- handler ปุ่ม Reject ----
  const handleRejectClick = () => {
    if (!order || !orderId || !canReject) return
    setIsRejectModalOpen(true)
  }

  const confirmReject = async () => {
    if (!order || !orderId) return
    setActionLoading("reject")
    setError(null)
    try {
      await cancelledOrder(order.id)
      // อัปเดต state ในหน้า ให้ status เป็น Cancelled
      setData((prev) =>
        prev
          ? {
              ...prev,
              order: { ...prev.order, status: "Cancelled" },
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

  // ---- handler ปุ่ม Accept ----
  const handleAccept = async () => {
    if (!order || !orderId || !canAccept) return
    setActionLoading("accept")
    setError(null)
    try {
      await updateOrderStatus(order.id, {
        status: "Completed", // 👈 ห่อเป็น object ตาม interface ใหม่
      })

      // อัปเดต state เป็น Completed
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

  return (
    <div className="max-w-5xl mx-auto py-10">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          ข้อมูลการสั่งซื้อ
        </h1>
        <p className="text-lg md:text-xl font-semibold tracking-[0.2em]">
          ORDER : #{orderId}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex justify-center">
        <div className="w-full max-w-3xl rounded-3xl bg-gray-100 px-8 py-5">
          <div className="relative">
            <div className="absolute top-4 left-[calc(100%/12)] right-[calc(100%/12)] h-[2px] bg-gray-300" />
            <div className="relative flex justify-between">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentStep
                return (
                  <div
                    key={step.key}
                    className="flex-1 w-full flex flex-col items-center text-[10px] md:text-xs z-10"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold
            ${
              isActive
                ? "border-black bg-black text-white"
                : "border-gray-400 bg-white text-gray-500"
            }`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`mt-2 uppercase text-[9px] md:text-[11px] tracking-tight whitespace-nowrap ${
                        isActive ? "text-black" : "text-gray-400"
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

      {/* Card หลัก */}
      <div className="rounded-3xl bg-gray-100 px-8 py-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
              <Store className="h-5 w-5 text-gray-700" />
            </div>
            <Link to={`/store/${order?.store_id}`}>
              <span className="font-semibold text-gray-700">{store_name}</span>
            </Link>
          </div>
          {/* <button className="text-sm font-semibold underline">Chat</button> */}
        </div>

        <hr className="border-gray-300 mb-4" />

        {loading && (
          <p className="text-center text-sm text-gray-500">กำลังโหลด...</p>
        )}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        {order && !loading && !error && (
          <>
            {/* 2 คอลัมน์ */}
            <div className=" gap-4 mb-6">
              {/* ซ้าย */}
              <div className="space-y-4">
                <div className="rounded-2xl bg-white px-4 py-3 min-h-[96px]">
                  <p className="font-semibold mb-1">ชื่อผู้ซื้อ</p>
                  <p className="text-sm text-gray-700">
                    {buyer_name || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 min-h-[140px]">
                  <p className="font-semibold mb-1">รายละเอียด</p>
                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                    {items.map((it) => (
                      <li key={it.order_item_id}>
                        สินค้า {it.product_name} × {it.quantity} —{" "}
                        {it.subtotal.toLocaleString()} บาท
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="list-none text-gray-400">
                        ยังไม่มีข้อมูลสินค้า
                      </li>
                    )}
                  </ul>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                    <p className="font-semibold">รวมทั้งหมด</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {order.total_price.toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </div>

              {/* ขวา */}
              {/* <div>
                <div className="rounded-2xl bg-white px-4 py-3 min-h-[180px]">
                  <p className="font-semibold mb-1">จุดนัดรับ</p>
                  <p className="text-sm text-gray-700">LX ชั้น 1</p>
                </div>
              </div> */}
            </div>

            {/* ปุ่ม Reject / Accept */}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleRejectClick}
                disabled={!canReject || actionLoading === "reject"}
                className={`px-10 py-2 rounded-md text-sm font-semibold text-white
                  ${
                    !canReject || actionLoading === "reject"
                      ? "bg-red-200 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
              >
                {actionLoading === "reject" ? "กำลังยกเลิก..." : "Reject"}
              </button>

              {!isBuyer && (
                <button
                  onClick={handleAccept}
                  disabled={!canAccept || actionLoading === "accept"}
                  className={`px-10 py-2 rounded-md text-sm font-semibold text-white
                    ${
                      !canAccept || actionLoading === "accept"
                        ? "bg-green-200 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                >
                  {actionLoading === "accept" ? "กำลังยืนยัน..." : "Accept"}
                </button>
              )}
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
      />
    </div>
  )
}
