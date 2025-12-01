// src/pages/cart/CartPage.tsx
import { useEffect, useState } from "react"
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
} from "lucide-react"
import { useCartStore } from "../../stores/cartStore"
import { useCartApi } from "../../api/cartApi"
import { Link } from "react-router-dom"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"

type CartItem = {
  id: number
  productId: number
  name: string
  price: number
  quantity: number
  image: string
  subtotal: number
}

type CartStore = {
  id: number
  name: string
  items: CartItem[]
}

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
      {checked && (
        <span className="h-[8px] w-[8px] rounded-[2px] bg-white/90" />
      )}
    </span>
  )
}

function CartItemRow({
  item,
  onDelete,
  onUpdateQuantity,
}: {
  item: CartItem
  onDelete: (id: number) => void
  onUpdateQuantity: (id: number, newQty: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex flex-1 items-center gap-4">
        <ToggleIcon checked />

        <div className="h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col">
          <p className="text-base font-semibold text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-500">
            {item.price > 0 ? `${formatPrice(item.price)} บาท` : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
          <button 
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-[#f15a24]"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-5 text-sm font-semibold text-gray-900">
            {item.quantity}
          </span>
          <button 
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-[#f15a24]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="w-24 text-right text-lg font-semibold text-gray-900">
          {item.subtotal > 0 ? `${formatPrice(item.subtotal)} บาท` : "—"}
        </p>
        <div className="flex items-center gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:border-orange-300 hover:text-[#f15a24]">
            <Heart className="h-5 w-5" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d73c30] text-white shadow-sm hover:bg-[#bf3228]"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CartStoreBlock({
  store,
  onDeleteItem,
  onUpdateQuantity,
}: {
  store: CartStore
  onDeleteItem: (id: number) => void
  onUpdateQuantity: (id: number, newQty: number) => void
}) {
  const totalItems = store.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-2">
        <ToggleIcon checked />
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <StoreIcon className="h-5 w-5 text-gray-700" />
          <span>{store.name}</span>
          <span className="text-sm font-normal text-gray-500">
            ({totalItems} รายการ)
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {store.items.map((item) => (
          <CartItemRow 
            key={item.id} 
            item={item} 
            onDelete={onDeleteItem} 
            onUpdateQuantity={onUpdateQuantity}
          />
        ))}
      </div>
    </div>
  )
}

export default function CartPage() {
  const { getCart, deleteItemCart, updateCart } = useCartApi()
  const { cart, isLoading, error, startLoading, setCart, setError } =
    useCartStore()

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        startLoading()
        const res = await getCart()
        if (!cancelled) {
          setCart(res.data)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setError("ไม่สามารถโหลดตะกร้าได้")
      }
    }

    if (!cart) {
      load()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDeleteClick(id: number) {
    setDeleteId(id)
    setIsDeleteModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    try {
      await deleteItemCart(deleteId)
      const res = await getCart()
      setCart(res.data)
      setIsDeleteModalOpen(false)
      setDeleteId(null)
    } catch (err) {
      console.error(err)
      setError("ลบสินค้าไม่สำเร็จ")
    }
  }

  async function handleUpdateQuantity(id: number, newQty: number) {
    if (newQty === 0) {
      handleDeleteClick(id)
      return
    }
    if (newQty < 0) return

    try {
      await updateCart(id, { quantity: newQty })
      const res = await getCart()
      setCart(res.data)
    } catch (err) {
      console.error(err)
      setError("อัปเดตจำนวนไม่สำเร็จ")
    }
  }

  let uiStores: CartStore[] = []
  let totalItems = 0
  let totalPrice = 0

  if (cart) {
    const storeMap = new Map<number, CartStore>()

    for (const it of cart.items) {
      const storeId = it.store_id
      const existing = storeMap.get(storeId)

      const item: CartItem = {
        id: it.id,
        productId: it.product_id,
        name: it.product_name,
        price: it.product_price,
        quantity: it.quantity,
        image: it.product_image_url || "https://via.placeholder.com/160",
        subtotal: it.subtotal,
      }

      if (!existing) {
        storeMap.set(storeId, {
          id: storeId,
          name: it.store_name,
          items: [item],
        })
      } else {
        existing.items.push(item)
      }
    }

    uiStores = Array.from(storeMap.values())

    totalItems =
      typeof cart.totalQuantity === "number"
        ? cart.totalQuantity
        : uiStores.reduce(
            (sum, store) =>
              sum + store.items.reduce((s, item) => s + item.quantity, 0),
            0
          )

    totalPrice = uiStores.reduce(
      (sum, store) =>
        sum + store.items.reduce((s, item) => s + item.subtotal, 0),
      0
    )
  }

  if (isLoading && !cart) {
    return (
      <div className="pt-10 pb-24">
        <p className="text-center text-sm text-gray-500">กำลังโหลดตะกร้า...</p>
      </div>
    )
  }

  if (error && !cart) {
    return (
      <div className="pt-10 pb-24">
        <p className="text-center text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="pt-10 pb-24">
      <div className="flex items-center gap-3 text-gray-900">
        <ShoppingCart className="h-7 w-7 text-black" />
        <h1 className="text-2xl font-semibold">ตะกร้าทั้งหมด ({totalItems})</h1>
      </div>

      <section className="mt-8 w-full rounded-[28px] border border-gray-200 bg-[#f7f7f7] px-10 py-10 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
        {!cart || uiStores.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            ยังไม่มีสินค้าในตะกร้า
          </p>
        ) : (
          <>
            <div className="space-y-6">
              {uiStores.map((store) => (
                <CartStoreBlock
                  key={store.id}
                  store={store}
                  onDeleteItem={handleDeleteClick}
                  onUpdateQuantity={handleUpdateQuantity}
                />
              ))}
            </div>

            <div className="mt-10 flex justify-end pr-2">
              <div className="flex items-baseline gap-2 text-right">
                <p className="text-sm text-gray-600">
                  รวม ({totalItems} สินค้า)
                </p>
                <span className="text-sm text-gray-700">:</span>
                <p className="text-xl font-semibold text-[#d73c30]">
                  {totalPrice > 0 ? `${formatPrice(totalPrice)} บาท` : "— บาท"}
                </p>
              </div>
            </div>
          </>
        )}
      </section>
      <Link to="/checkout" className="text-2xl font-bold text-orange-600">
        ยืนยันรายาการคำสั่งซื้อ
      </Link>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบสินค้า"
        message="คุณต้องการลบสินค้านี้ออกจากตะกร้าใช่หรือไม่?"
        confirmText="ลบสินค้า"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </div>
  )
}
