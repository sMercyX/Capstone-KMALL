// src/pages/cart/CheckoutPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ShoppingCart, Store as StoreIcon, Truck, Package, Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "react-toastify"
import BackButton from "../../components/Buttons/BackButton"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import { useCheckkOutApi, type orderCreatedRequest } from "../../api/checkOutApi"
import DeliveryAddressDropdown from "../../components/Dropdown/DeliveryAddressDropdown"
import { resolveImageUrl } from "../../utils/resolve"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"

const MOCK_ADDRESSES = [
  { id: 1, detail: "Address 1 - 123 Sukhumvit Rd." },
  { id: 2, detail: "Address 2 - 456 Rama II Rd." },
  { id: 3, detail: "Address 3 - University dormitory" },
]


type CheckoutItem = {
  id: number
  name: string
  price: number
  quantity: number
  image: string
  subtotal: number
  variantLabel?: string
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
  const { getCart, updateCart, deleteItemCart } = useCartApi()
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

  const [submitting, setSubmitting] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null)

  function handleConfirmClick() {
    setIsConfirmModalOpen(true)
  }

  async function handleUpdateQuantity(id: number, newQty: number) {
    if (newQty <= 0) {
      handleDeleteClick(id)
      return
    }
    if (newQty > 99) {
      toast.warn("You can purchase up to 99 units per item.")
      return
    }
    try {
      await updateCart(id, { quantity: newQty })
      const res = await getCart()
      setCart(res.data)
    } catch (err) {
      console.error(err)
      toast.error("Unable to update quantity.")
    }
  }

  function handleDeleteClick(id: number) {
    setItemToDeleteId(id)
    setIsDeleteModalOpen(true)
  }

  async function handleConfirmDelete() {
    if (!itemToDeleteId) return
    try {
      await deleteItemCart(itemToDeleteId)
      const res = await getCart()
      setCart(res.data)
      toast.success("Item removed from your cart.")
    } catch (err) {
      console.error(err)
      toast.error("Unable to remove item.")
    } finally {
      setIsDeleteModalOpen(false)
      setItemToDeleteId(null)
    }
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
        setError("Unable to load cart.")
      }
    })()
  }, [cart, isLoading, getCart, setCart, setError, startLoading])

  let stores: CheckoutStore[] = []
  let totalItems = 0
  let merchandiseTotal = 0


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
        variantLabel: it.variant_label,
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

  const grandTotal = merchandiseTotal

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
      toast.success("Order placed successfully!")
      
      // Redirect to order detail page
      navigate(`/orders/${res.data.order.id}`)
    } catch (err) {
      console.error(err)
      alert("Unable to place order.")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading && !cart) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-500">
        Loading cart...
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
          <BackButton className="mr-2" />
          <ShoppingCart className="h-7 w-7" />
          <h1 className="text-2xl font-semibold">Checkout</h1>
        </div>

        <div className="grid items-start gap-16 lg:grid-cols-[0.6fr_0.4fr]">
          {/* LEFT FORM */}
          <section className="space-y-10">
            {/* Delivery Method Selection */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Delivery method</h2>
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
                    <h3 className="font-semibold text-base mb-1">Campus pickup</h3>
                    <p className="text-sm text-gray-500">Wait for the seller to confirm the date and time.</p>
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
                    <h3 className="font-semibold text-base mb-1">Round University Delivery</h3>
                    <p className="text-sm text-gray-500">Choose a saved delivery address.</p>
                  </div>
                </div>

                {/* Pickup Instructions Warning */}
                {deliveryMethod === "CAMPUS" && (
                  <div className="col-span-1 md:col-span-2 mt-4 rounded-xl border border-yellow-400 bg-yellow-50 p-6 relative">
                    <div className="flex gap-3 mb-3">
                      <AlertCircle className="h-6 w-6 text-yellow-700 shrink-0" />
                      <h3 className="font-bold text-lg text-yellow-800">
                        Please Note: Pickup Instructions
                      </h3>
                    </div>
                    
                    <ul className="space-y-2 text-yellow-900 ml-9 text-sm">
                      <li className="list-disc">
                        For pickup orders, the seller will specify the location, date, and time for pickup.
                      </li>
                      <li className="list-disc">
                        The seller will provide these details in the 'Proposed' step.
                      </li>
                      <li className="list-disc">
                        You can also discuss further via the order chat.
                      </li>
                      <li className="list-disc">
                        The buyer must confirm the pickup details before proceeding to the next step.
                      </li>
                    </ul>
                  </div>
                )}

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
                  placeholder="Additional delivery details"
                  value={addressExtra}
                  onChange={(e) => setAddressExtra(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            )}




          </section>

          {/* RIGHT SUMMARY */}
          <section className="rounded-[28px] border border-gray-200 bg-[#f7f7f7] px-10 py-10 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            {stores.length === 0 ? (
              <p className="text-center text-sm text-gray-400">
                No items in your cart.
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
                        items)
                      </span>
                    </div>

                    <div className="space-y-6">
                      {store.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="relative inline-block shrink-0">
                                <div className="rounded-[18px] border border-orange-100 bg-white p-1 shadow-sm">
                                    <div className="overflow-hidden rounded-[14px]">
                                        <img
                                        src={resolveImageUrl(item.image)}
                                        className="h-20 w-20 object-cover"
                                        alt={item.name}
                                        />
                                    </div>
                                </div>
                                <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#ff5a1f] text-sm font-semibold text-white shadow-md">
                                    {item.quantity}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                                {item.variantLabel && (
                                    <p className="text-[10px] text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full w-fit">
                                        {item.variantLabel}
                                    </p>
                                )}
                                <div className="flex items-center gap-3 mt-1">
                                    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white shadow-sm h-8">
                                        <button 
                                            type="button"
                                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} 
                                            className="px-2 hover:text-orange-500 transition-colors"
                                        >
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <span className="px-1 text-xs font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                                        <button 
                                            type="button"
                                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} 
                                            className="px-2 hover:text-orange-500 transition-colors"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleDeleteClick(item.id)} 
                                        className="p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-all active:scale-95"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                          </div>

                          <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                            ฿{formatPrice(item.subtotal)}
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




                <div className="mt-5 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="text-xl font-bold text-[#d73c30]">
                    ฿{formatPrice(grandTotal)}
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
          Confirm Order
        </button>
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleSubmit}
        title="Confirm your order"
        message="Do you want to place this order?"
        confirmText="Confirm"
        cancelText="Cancel"
        variant="info"
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setItemToDeleteId(null)
        }}
        onConfirm={handleConfirmDelete}
        title="Remove item from cart?"
        message="Are you sure you want to remove this item from your cart?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
