// src/pages/cart/CheckoutPage.tsx
import { useEffect, useState } from "react"
import { ShoppingCart, Store as StoreIcon, Building2, Truck, ArrowLeft } from "lucide-react"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import { useUserStore } from "../../stores/userStore"
import { useCheckkOutApi, type orderCreatedRequest } from "../../api/checkOutApi"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

type DeliveryMethod = "CAMPUS" | "ROUND_UNIVERSITY"

type CheckoutItem = {
  id: number
  name: string
  price: number
  quantity: number
  image: string
  subtotal: number
}

type CheckoutStore = {
  id: number
  name: string
  items: CheckoutItem[]
  subtotal: number
}

const formatPrice = (v: number) =>
  v.toLocaleString("th-TH", { minimumFractionDigits: 0 })

export default function CheckoutPage() {
  const { getCart } = useCartApi()
  const {
    cart,
    isLoading,
    error,
    startLoading,
    setCart,
    setError,
    reset,
  } = useCartStore()

  const { checkOutOrder } = useCheckkOutApi()
  const navigate = useNavigate()

  const { email } = useUserStore()

  const [addressExtra, setAddressExtra] = useState("")
  const [note, setNote] = useState("")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("CAMPUS")
  const [submitting, setSubmitting] = useState(false)

  // โหลด cart ถ้ายังไม่มี
  useEffect(() => {
    if (cart || isLoading) return

    ;(async () => {
      try {
        startLoading()
        const res = await getCart()
        setCart(res.data)
      } catch (err) {
        console.error(err)
        setError("ไม่สามารถโหลดตะกร้าได้")
      }
    })()
  }, [cart, isLoading, getCart, setCart, setError, startLoading])

  let stores: CheckoutStore[] = []
  let totalItems = 0
  let merchandiseTotal = 0
  const shippingFee = deliveryMethod === "CAMPUS" ? 0 : 10

  if (cart) {
    const storeMap = new Map<number, CheckoutStore>()

    for (const it of cart.items) {
      const item: CheckoutItem = {
        id: it.id,
        name: it.product_name,
        price: it.product_price,
        quantity: it.quantity,
        image:
          it.product_image_url ||
          "https://via.placeholder.com/160?text=Product",
        subtotal: it.subtotal,
      }

      const existing = storeMap.get(it.store_id)
      if (!existing) {
        storeMap.set(it.store_id, {
          id: it.store_id,
          name: it.store_name,
          items: [item],
          subtotal: item.subtotal,
        })
      } else {
        existing.items.push(item)
        existing.subtotal += item.subtotal
      }
    }

    stores = Array.from(storeMap.values())

    totalItems =
      typeof cart.totalQuantity === "number"
        ? cart.totalQuantity
        : stores.reduce(
            (sum, s) =>
              sum + s.items.reduce((ss, i) => ss + i.quantity, 0),
            0,
          )

    merchandiseTotal = stores.reduce((sum, s) => sum + s.subtotal, 0)
  }

  const grandTotal = merchandiseTotal + shippingFee

  async function handleSubmit() {
    if (!cart) return

    try {
      setSubmitting(true)

      const payload: orderCreatedRequest = {
        fulfillment_type: "STANDARD",
        promised_ship_date: new Date().toISOString(),
        deposit_amount: grandTotal,
        delivery_method: deliveryMethod,
      }

      const res = await checkOutOrder(payload)

      console.log("Order created:", res.data.order)

      reset()
      
      toast.success(`ยืนยันออเดอร์สำเร็จ! เลขคำสั่งซื้อ #${res.data.order.order_id}`)
      navigate(`/orders/${res.data.order.order_id}`)
    } catch (err) {
      console.error(err)
      toast.error("ยืนยันออเดอร์ไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading && !cart) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-500">
        กำลังโหลดตะกร้า...
      </div>
    )
  }

  if (error && !cart) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[calc(100%-110px)] pt-16 pb-24">
        <div className="mb-10 flex items-center gap-3 text-gray-900">
          <ShoppingCart className="h-7 w-7" />
          <h1 className="text-2xl font-semibold">ทำการสั่งซื้อ</h1>
        </div>

        <div className="grid items-start gap-16 lg:grid-cols-[0.6fr_0.4fr]">
          {/* LEFT FORM */}
          <section className="space-y-10">
            <div>
              <h2 className="text-lg font-semibold">ที่อยู่จัดส่ง</h2>

              <p className="mt-3 text-sm font-medium">
                {email || "example@kmutt.ac.th"}
              </p>

              <input
                type="text"
                placeholder="ระบุจุดรับเพิ่มเติม เช่น รออยู่ CBI ตรงร้านถ่ายเอกสารนะครับ"
                value={addressExtra}
                onChange={(e) => setAddressExtra(e.target.value)}
                className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold">หมายเหตุ</h2>
              <input
                type="text"
                placeholder="ระบุหมายเหตุเพิ่มเติม"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* Delivery Method Selection */}
            <div>
              <h2 className="text-lg font-semibold mb-4">เลือกวิธีการจัดส่ง</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* ส่งภายในมอ */}
                <button
                  type="button"
                  onClick={() => setDeliveryMethod("CAMPUS")}
                  className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                    deliveryMethod === "CAMPUS"
                      ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                      : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50"
                  }`}
                >
                  {deliveryMethod === "CAMPUS" && (
                    <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white">
                      ✓
                    </span>
                  )}
                  <Building2 className={`h-10 w-10 ${deliveryMethod === "CAMPUS" ? "text-orange-500" : "text-gray-400"}`} />
                  <div className="text-center">
                    <p className={`font-semibold ${deliveryMethod === "CAMPUS" ? "text-orange-600" : "text-gray-700"}`}>
                      ส่งภายในมอ
                    </p>
                    <p className="mt-1 text-xs text-gray-500">ส่งภายในมหาวิทยาลัย</p>
                    <p className="mt-2 text-sm font-bold text-green-600">ฟรี!</p>
                  </div>
                </button>

                {/* ส่งรอบมอ */}
                <button
                  type="button"
                  onClick={() => setDeliveryMethod("ROUND_UNIVERSITY")}
                  className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                    deliveryMethod === "ROUND_UNIVERSITY"
                      ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                      : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50"
                  }`}
                >
                  {deliveryMethod === "ROUND_UNIVERSITY" && (
                    <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white">
                      ✓
                    </span>
                  )}
                  <Truck className={`h-10 w-10 ${deliveryMethod === "ROUND_UNIVERSITY" ? "text-orange-500" : "text-gray-400"}`} />
                  <div className="text-center">
                    <p className={`font-semibold ${deliveryMethod === "ROUND_UNIVERSITY" ? "text-orange-600" : "text-gray-700"}`}>
                      ส่งรอบมอ
                    </p>
                    <p className="mt-1 text-xs text-gray-500">ส่งรอบมหาวิทยาลัย</p>
                    <p className="mt-2 text-sm font-bold text-gray-600">10 บาท</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 shadow-[0_10px_20px_rgba(0,0,0,0.08)] hover:border-gray-300"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>ย้อนกลับ</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !cart || totalItems === 0}
                className="rounded-xl bg-[#f0532c] px-10 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#e24420] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "กำลังยืนยัน..." : "ยืนยันออเดอร์"}
              </button>
            </div>
          </section>

          {/* RIGHT SUMMARY */}
          <section className="rounded-[28px] border border-gray-200 bg-[#f7f7f7] px-10 py-10 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            {stores.length === 0 ? (
              <p className="text-center text-sm text-gray-400">
                ยังไม่มีสินค้าในตะกร้า
              </p>
            ) : (
              <>
                {stores.map((store) => (
                  <div key={store.id} className="mb-8 last:mb-0">
                    <div className="mb-6 flex items-center gap-2 text-base font-semibold">
                      <StoreIcon className="h-5 w-5" />
                      <span>{store.name}</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({store.items.reduce(
                          (s, i) => s + i.quantity,
                          0,
                        )}{" "}
                        รายการ)
                      </span>
                    </div>

                    <div className="space-y-6">
                      {store.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative inline-block">
                              <div className="rounded-[18px] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                                <div className="rounded-[18px] border border-orange-100 bg-white p-1">
                                  <div className="overflow-hidden rounded-[14px]">
                                    <img
                                      src={item.image}
                                      className="h-20 w-20 object-cover"
                                      alt={item.name}
                                    />
                                  </div>
                                </div>
                              </div>

                              <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#ff5a1f] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(255,90,31,0.6)]">
                                {item.quantity}
                              </span>
                            </div>

                            <p className="text-sm font-semibold">
                              {item.name}
                            </p>
                          </div>

                          <p className="text-sm font-semibold">
                            {formatPrice(item.price)} บาท
                          </p>
                        </div>
                      ))}
                    </div>

                    {stores.length > 1 && (
                      <div className="my-8 h-px w-full bg-gray-200" />
                    )}
                  </div>
                ))}

                <div className="my-8 h-px w-full bg-gray-200" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>รวมการสั่งซื้อ</span>
                    <span>{formatPrice(merchandiseTotal)} บาท</span>
                  </div>

                  <div className="flex justify-between">
                    <span>ค่าจัดส่ง ({deliveryMethod === "CAMPUS" ? "ภายในมอ" : "รอบมอ"})</span>
                    <span className={shippingFee === 0 ? "text-green-600 font-semibold" : ""}>
                      {shippingFee === 0 ? "ฟรี!" : `${formatPrice(shippingFee)} บาท`}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex justify-between text-base font-semibold">
                  <span>ยอดชำระทั้งหมด</span>
                  <span className="text-xl font-bold text-[#d73c30]">
                    {formatPrice(grandTotal)} บาท
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

