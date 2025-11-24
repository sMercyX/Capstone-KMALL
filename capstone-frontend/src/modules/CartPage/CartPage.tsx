import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
} from "lucide-react"

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

type CartStore = {
  id: string
  name: string
  items: CartItem[]
}

const CART_STORES: CartStore[] = [
  {
    id: "handmade",
    name: "Handmade Store",
    items: [
      {
        id: "bracelet",
        name: "กำไลข้อมือ",
        price: 39,
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
  },
]

const formatPrice = (value: number) =>
  value.toLocaleString("th-TH", { minimumFractionDigits: 0 })

function ToggleIcon({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${
        checked
          ? "border-[#f15a24] bg-[#f15a24] text-white"
          : "border-gray-300 bg-white"
      }`}
    >
      {/* แค่ทำให้เป็นบล็อกส้มเหมือนในภาพ ไม่ต้องมีไอคอนก็ได้ */}
      {checked && (
        <span className="h-[8px] w-[8px] rounded-[2px] bg-white/90" />
      )}
    </span>
  )
}

function CartItemRow({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      {/* ซ้าย: checkbox + รูป + ชื่อสินค้า */}
      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          className="flex items-center text-[#f15a24] transition hover:scale-[1.05]"
        >
          <ToggleIcon checked />
        </button>

        <div className="h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-base font-semibold text-gray-800">{item.name}</p>
          <p className="text-sm text-gray-500">
            {formatPrice(item.price)} บาท
          </p>
        </div>
      </div>

      {/* กลาง: ปุ่มจำนวนแบบรี */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-[#f15a24]"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-4 text-sm font-semibold text-gray-800">
            {item.quantity}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-[#f15a24]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ขวา: ราคารวม + ไอคอนหัวใจ/ถังขยะ */}
      <div className="flex items-center gap-4">
        <p className="w-20 text-right text-lg font-semibold text-gray-800">
          {formatPrice(item.price * item.quantity)} บาท
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-orange-200 hover:text-[#f15a24]"
          >
            <Heart className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d73c30] text-white shadow-sm hover:bg-[#bf3228]"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CartStoreBlock({ store }: { store: CartStore }) {
  const totalItems = store.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-4">
      {/* แถวชื่อร้าน */}
      <div className="flex items-center gap-3 pb-2">
        <button
          type="button"
          className="flex items-center text-[#f15a24] transition hover:scale-[1.05]"
        >
          <ToggleIcon checked />
        </button>
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <StoreIcon className="h-5 w-5 text-gray-700" />
          <span>{store.name}</span>
          <span className="text-sm font-normal text-gray-500">
            ({totalItems} รายการ)
          </span>
        </div>
      </div>

      {/* รายการสินค้า */}
      <div className="space-y-2">
        {store.items.map((item) => (
          <CartItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

export default function CartPage() {
  const totalItems = CART_STORES.reduce(
    (sum, store) =>
      sum + store.items.reduce((acc, item) => acc + item.quantity, 0),
    0,
  )
  const totalPrice = CART_STORES.reduce(
    (sum, store) =>
      sum +
      store.items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    0,
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-24">
        {/* หัวข้อหน้า */}
        <div className="flex items-center gap-3 text-gray-800">
          <ShoppingCart className="h-7 w-7 text-black" />
          <h1 className="text-2xl font-semibold">
            ตะกร้าทั้งหมด ({totalItems})
          </h1>
        </div>

        {/* การ์ดใหญ่เหมือนในภาพ */}
        <section className="mt-6 rounded-[28px] border border-gray-200 bg-[#f7f7f7] px-10 py-8 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
          <div className="space-y-6">
            {CART_STORES.map((store) => (
              <CartStoreBlock key={store.id} store={store} />
            ))}
          </div>

          {/* รวมราคาล่างขวา */}
          <div className="mt-8 flex justify-end pr-1">
            <div className="flex items-baseline gap-2 text-right">
              <p className="text-sm text-gray-600">
                รวม ({totalItems} สินค้า)
              </p>
              <span className="text-sm text-gray-700">:</span>
              <p className="text-xl font-semibold text-[#d73c30]">
                {formatPrice(totalPrice)} บาท
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
