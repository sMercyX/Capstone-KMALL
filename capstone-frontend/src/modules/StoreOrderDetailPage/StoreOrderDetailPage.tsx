// src/pages/store/StoreOrderDetailPage.tsx
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Store } from "lucide-react"

import { useOrderSellerApi, type OrderDetailResponse } from "../../api/orderSellerApi"

const STEPS = [
  { key: "PENDING", label: "PENDING" },
  { key: "ACCEPTED", label: "ACCEPTED" },
  { key: "ARRIVED", label: "ARRIVED" },
  { key: "COMPLETED", label: "COMPLETED" },
] as const

function getStepIndex(status: string): number {
  switch (status) {
    case "PENDING":
      return 0
    case "ACCEPTED":
      return 1
    case "ARRIVED":
      return 2
    case "COMPLETED":
      return 3
    default:
      return 0
  }
}

export default function StoreOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { getOrderDetail } = useOrderSellerApi()

  const [data, setData] = useState<OrderDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await getOrderDetail(Number(orderId))
        setData(res.data ?? null)
      } catch (e) {
        setError("ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้")
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  const order = data?.order
  const buyer = data?.buyer
  const items = data?.items ?? []
  const currentStep = order ? getStepIndex(order.status) : 0

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
        <div className="w-full max-w-3xl rounded-3xl bg-gray-100 px-8 py-5 flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isActive = idx <= currentStep
            return (
              <div
                key={step.key}
                className="flex-1 flex flex-col items-center text-xs md:text-sm"
              >
                <div className="flex items-center w-full">
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
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-[2px] flex-1 mx-1 ${
                        idx < currentStep ? "bg-black" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`mt-2 uppercase ${
                    isActive ? "text-black" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
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
            <span className="font-semibold">
              Handmade Store {/* เปลี่ยนเป็นชื่อร้านจริงได้ทีหลัง */}
            </span>
          </div>
          <button className="text-sm font-semibold underline">
            Chat
          </button>
        </div>

        <hr className="border-gray-300 mb-4" />

        {loading && (
          <p className="text-center text-sm text-gray-500">กำลังโหลด...</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}

        {order && !loading && !error && (
          <>
            {/* 2 คอลัมน์ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* ซ้าย */}
              <div className="space-y-4">
                <div className="rounded-2xl bg-white px-4 py-3 min-h-[96px]">
                  <p className="font-semibold mb-1">ชื่อผู้ซื้อ</p>
                  <p className="text-sm text-gray-700">
                    {buyer?.display_name || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 min-h-[140px]">
                  <p className="font-semibold mb-1">รายละเอียด</p>
                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                    {items.map((it) => (
                      <li key={it.order_item_id}>
                        สินค้า #{it.product_id} × {it.quantity} —{" "}
                        {it.subtotal.toLocaleString()} บาท
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="list-none text-gray-400">
                        ยังไม่มีข้อมูลสินค้า
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* ขวา */}
              <div>
                <div className="rounded-2xl bg-white px-4 py-3 min-h-[180px]">
                  <p className="font-semibold mb-1">จุดนัดรับ</p>
                  <p className="text-sm text-gray-700">
                    {/* ตอนนี้ยังไม่มี field ใน data เลยใส่ placeholder ก่อน */}
                    LX ชั้น 1
                  </p>
                </div>
              </div>
            </div>

            {/* ปุ่ม Accept */}
            <div className="flex justify-center">
              <button
                className={`px-10 py-2 rounded-md text-sm font-semibold ${
                  order.status === "PENDING"
                    ? "bg-gray-800 text-white hover:bg-black"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Accept
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
