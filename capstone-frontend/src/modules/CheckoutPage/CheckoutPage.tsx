import { MapPin, ShoppingCart, Store as StoreIcon } from "lucide-react"

type CheckoutItem = {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

type CheckoutStore = {
  id: string
  name: string
  items: CheckoutItem[]
}

const CHECKOUT_STORE: CheckoutStore = {
  id: "handmade",
  name: "Handmade Store",
  items: [
    {
      id: "bracelet",
      name: "กำไลข้อมือ",
      price: 78,
      quantity: 2,
      image:
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop",
    },
    {
      id: "necklace",
      name: "สร้อยคอ",
      price: 45,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&auto=format&fit=crop",
    },
  ],
}

const formatPrice = (v: number) =>
  v.toLocaleString("th-TH", { minimumFractionDigits: 0 })

export default function CheckoutPage() {
  const totalItems = CHECKOUT_STORE.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  )

  const merchandiseTotal = CHECKOUT_STORE.items.reduce(
    (sum, item) => sum + item.price,
    0,
  )
  const shippingFee = 10
  const grandTotal = merchandiseTotal + shippingFee

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[calc(100%-110px)] pt-16 pb-24">
        <div className="mb-10 flex items-center gap-3 text-gray-900">
          <ShoppingCart className="h-7 w-7" />
          <h1 className="text-2xl font-semibold">ทำการสั่งซื้อ</h1>
        </div>

        <div className="grid items-start gap-16 lg:grid-cols-[0.6fr_0.4fr]">
          <section className="space-y-10">
            <div>
              <h2 className="text-lg font-semibold">ที่อยู่จัดส่ง</h2>

              <p className="mt-3 text-sm font-medium">
                nitchan.konk@kmutt.ac.th
              </p>

              <input
                type="text"
                placeholder="ระบุจุดรับเพิ่มเติม เช่น รออยู่ CBI ตรงร้านถ่ายเอกสารนะครับ"
                className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold">หมายเหตุ</h2>
              <input
                type="text"
                placeholder="ระบุหมายเหตุเพิ่มเติม"
                className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-orange-600 shadow-[0_10px_20px_rgba(0,0,0,0.08)] hover:border-orange-300"
              >
                <MapPin className="h-4 w-4" />
                <span>Map KMUTT</span>
              </button>

              <button
                type="button"
                className="rounded-xl bg-[#f0532c] px-10 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#e24420]"
              >
                ยืนยันออเดอร์
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-200 bg-[#f7f7f7] px-10 py-10 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <div className="mb-6 flex items-center gap-2 text-base font-semibold">
              <StoreIcon className="h-5 w-5" />
              <span>{CHECKOUT_STORE.name}</span>
              <span className="text-xs font-normal text-gray-500">
                ({totalItems} รายการ)
              </span>
            </div>

            <div className="space-y-6">
              {CHECKOUT_STORE.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative inline-block">
                      <div className="rounded-[18px] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                        <div className="rounded-[18px] border border-orange-100 bg-white p-1">
                          <div className="overflow-hidden rounded-[14px]">
                            <img
                              src={item.image}
                              className="h-20 w-20 object-cover"
                            />
                          </div>
                        </div>
                      </div>

                      <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#ff5a1f] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(255,90,31,0.6)]">
                        {item.quantity}
                      </span>
                    </div>

                    <p className="text-sm font-semibold">{item.name}</p>
                  </div>

                  <p className="text-sm font-semibold">
                    {formatPrice(item.price)} บาท
                  </p>
                </div>
              ))}
            </div>

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
          </section>
        </div>
      </div>
    </div>
  )
}
