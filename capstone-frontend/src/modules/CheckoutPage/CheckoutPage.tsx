// src/pages/cart/CheckoutPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingCart, Store as StoreIcon, Truck, Package } from "lucide-react"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import { useCheckkOutApi, type orderCreatedRequest } from "../../api/checkOutApi"
import DeliveryAddressDropdown from "../../components/Dropdown/DeliveryAddressDropdown"
import { resolveImageUrl } from "../../utils/resolve"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"

const MOCK_ADDRESSES = [
  { id: 1, detail: "ที่อยู่ 1 - บ้านเลขที่ 123 ถนนสุขุมวิท" },
  { id: 2, detail: "ที่อยู่ 2 - บ้านเลขที่ 456 ถนนพระราม 2" },
  { id: 3, detail: "ที่อยู่ 3 - หอพักมหาวิทยาลัย" },
]


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
  // ดึง cart (getCart) จาก cartApi
  const { getCart } = useCartApi()
  const {
    cart,
    isLoading,
    error,
    startLoading,
    setCart,
    setError,
  } = useCartStore()

  // ยิง checkout (checkOutOrder) จาก storeApi
  const { checkOutOrder } = useCheckkOutApi()


  const { reset } = useCartStore()
  const navigate = useNavigate()

  const [deliveryMethod, setDeliveryMethod] = useState<"CAMPUS" | "ROUND_UNIVERSITY">("CAMPUS")
  const [campusLocationId] = useState<number>(1) // Default campus location
  const [deliveryAddressId, setDeliveryAddressId] = useState<number>(1) // Default delivery address
  const [addressExtra, setAddressExtra] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  function handleConfirmClick() {
    setIsConfirmModalOpen(true)
  }

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
  const shippingFee = 10

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

      // payload สำหรับ /api/checkout/confirm
      const payload: orderCreatedRequest = {
        fulfillment_type: "STANDARD", // หรือให้เลือกจาก UI ทีหลังได้
        promised_ship_date: new Date().toISOString(), // ปรับให้ตรง logic BE ถ้าต้องการ
        deposit_amount: grandTotal, // ถ้าต้องการมัดจำบางส่วนเปลี่ยนค่าตรงนี้ได้
        delivery_method: deliveryMethod,
      }

      // เพิ่มข้อมูลตาม delivery method ที่เลือก
      if (deliveryMethod === "CAMPUS") {
        payload.campus_location_id = campusLocationId
      } else if (deliveryMethod === "ROUND_UNIVERSITY") {
        payload.delivery_address_id = deliveryAddressId
      }

      const res = await checkOutOrder(payload)

      console.log("Order created:", res.data.order)

      reset()
      
      // Redirect to order detail page
      navigate(`/orders/${res.data.order.id}`)
    } catch (err) {
      console.error(err)
      alert("ยืนยันออเดอร์ไม่สำเร็จ")
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
            {/* Delivery Method Selection */}
            <div>
              <h2 className="text-2xl font-bold mb-6">วิธีการจัดส่ง</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Campus Pickup */}
                <div 
                  onClick={() => setDeliveryMethod("CAMPUS")}
                  className={`
                    cursor-pointer rounded-xl border-2 p-6 transition-all duration-200
                    flex flex-col gap-4 text-left relative overflow-hidden group hover:shadow-md
                    ${deliveryMethod === "CAMPUS" 
                      ? "border-green-500 bg-white ring-1 ring-green-500" 
                      : "border-gray-200 bg-white hover:border-gray-300"}
                  `}
                >
                  <div className="text-gray-900">
                    <Truck className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">นัดรับ</h3>
                    <p className="text-sm text-gray-500">รอวันและเวลาที่ชัดเจนจากผู้ขาย</p>
                  </div>
                </div>

                {/* Card 2: Round University (Disabled) */}
                <div 
                  className={`
                    rounded-xl border-2 p-6 transition-all duration-200
                    flex flex-col gap-4 text-left relative overflow-hidden
                    border-gray-200 bg-gray-50 opacity-50 grayscale cursor-not-allowed
                  `}
                >
                  <div className="absolute top-3 right-3 bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded-full font-medium">
                    Coming Soon
                  </div>
                  <div className="text-gray-900">
                    <Package className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">ส่งรอบมหาวิทยาลัย</h3>
                    <p className="text-sm text-gray-500">เลือกที่จัดส่งที่ตนเองบันทึกไว้</p>
                  </div>
                </div>

                {/* Card 2: Round University */}
                {/* <div 
                  onClick={() => setDeliveryMethod("ROUND_UNIVERSITY")}
                  className={`
                    cursor-pointer rounded-xl border-2 p-6 transition-all duration-200
                    flex flex-col gap-4 text-left relative overflow-hidden group hover:shadow-md
                    ${deliveryMethod === "ROUND_UNIVERSITY" 
                      ? "border-green-500 bg-white ring-1 ring-green-500" 
                      : "border-gray-200 bg-white hover:border-gray-300"}
                  `}
                >
                  <div className="text-gray-900">
                    <Package className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">ส่งรอบมหาวิทยาลัย</h3>
                    <p className="text-sm text-gray-500">เลือกที่จัดส่งที่ตนเองบันทึกไว้</p>
                  </div>
                </div> */}

              </div>
            </div>

            {/* Conditional Fields Based on Delivery Method */}
            {deliveryMethod === "CAMPUS" ? (
              <></>
            ) : (
              <div className="space-y-4">
                <DeliveryAddressDropdown
                  value={deliveryAddressId}
                  onChange={(val) => setDeliveryAddressId(val || 1)}
                  addresses={MOCK_ADDRESSES}
                />
                <input
                  type="text"
                  placeholder="ข้อมูลเพิ่มเติมสำหรับการจัดส่ง"
                  value={addressExtra}
                  onChange={(e) => setAddressExtra(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold mb-4">หมายเหตุ</h2>
              <input
                type="text"
                placeholder="ระบุหมายเหตุเพิ่มเติม"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-400"
              />
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
                                      src={resolveImageUrl(item.image)}
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
                    <span>ค่าจัดส่ง</span>
                    <span>{formatPrice(shippingFee)} บาท</span>
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
      
      <div className="mt-12 flex justify-center w-full">
        <button
          type="button"
          onClick={handleConfirmClick}
          disabled={submitting || !cart || totalItems === 0}
          className="rounded-xl bg-[#f0532c] px-20 py-4 text-base font-semibold text-white shadow-lg hover:bg-[#e24420] disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          ยืนยันออเดอร์
        </button>
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleSubmit}
        title="ยืนยันการสั่งซื้อ"
        message="คุณต้องการยืนยันการสั่งซื้อสินค้าใช่หรือไม่?"
        confirmText="ยืนยัน"
        cancelText="ยกเลิก"
        variant="info"
      />
    </div>
  )
}
