import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingCart, X } from "lucide-react"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"

type Props = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export default function CartDropdown({ isOpen, onToggle, onClose }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const navigate = useNavigate()
  const { getCart, deleteItemCart } = useCartApi()
  const {
    cart,
    isLoading: cartLoading,
    error: cartError,
    startLoading: startCartLoading,
    setCart,
    setError: setCartError,
  } = useCartStore()

  const totalQuantity = cart?.totalQuantity ?? 0

  // เปิด dropdown cart แล้วค่อยโหลด ถ้ายังไม่มี cart
  useEffect(() => {
    if (!isOpen) return
    if (cart || cartLoading) return

    ;(async () => {
      try {
        startCartLoading()
        const res = await getCart()
        setCart(res.data)
      } catch (err) {
        console.error("Failed to load cart", err)
        setCartError("โหลดตะกร้าไม่สำเร็จ")
      }
    })()
  }, [isOpen, cart, cartLoading, getCart, setCart, setCartError, startCartLoading])

  async function handleDeleteItem(id: number) {
    try {
      setDeletingId(id)
      await deleteItemCart(id)
      const res = await getCart()
      setCart(res.data)
    } catch (err) {
      console.error("Failed to delete cart item", err)
      setCartError("ลบสินค้าไม่สำเร็จ")
    } finally {
      setDeletingId(null)
    }
  }

  const handleGoToCart = () => {
    onClose()
    navigate("/cart")
  }

  return (
    <div className="relative">
      <button
        className="relative cursor-pointer"
        onClick={onToggle}
      >
        <ShoppingCart className="h-6 w-6 text-[--icon-color] hover:text-orange-600" />
        {totalQuantity > 0 && (
          <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full px-1.5">
            {totalQuantity}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[360px] rounded-3xl bg-white shadow-xl border border-orange-200 p-5 z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-gray-900">
                สินค้าทั้งหมดในตะกร้า ({totalQuantity})
              </span>
            </div>
            <button onClick={onClose}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div className="h-[1px] bg-gray-100 mb-3" />

          {/* Items */}
          <div className="mt-4 max-h-72 overflow-y-auto space-y-3">
            {cartLoading && (
              <p className="text-center text-sm text-gray-400">
                กำลังโหลดสินค้า...
              </p>
            )}

            {!cartLoading && cartError && (
              <p className="text-center text-sm text-red-500">
                {cartError}
              </p>
            )}

            {!cartLoading &&
              !cartError &&
              (!cart || cart.items.length === 0) && (
                <p className="text-center text-sm text-gray-400">
                  ยังไม่มีสินค้าในตะกร้า
                </p>
              )}

            {!cartLoading &&
              !cartError &&
              cart &&
              cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 text-sm"
                >

                  {/* IMG */}
                  <div className="h-16 w-16 rounded-lg bg-gray-200 overflow-hidden">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                        IMG
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 line-clamp-1">
                      {item.product_name || `สินค้า #${item.product_id}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      จำนวน {item.quantity} ชิ้น
                    </p>
                  </div>

                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 shadow-md shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={deletingId === item.id}
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
          </div>

          {/* Footer */}
          <div className="mt-5 flex flex-col items-center gap-3">
            {/* {totalQuantity > 0 && (
              <div className="text-sm text-gray-600">
                รวมทั้งหมด{" "}
                <span className="font-semibold text-gray-900">
                  {totalQuantity}
                </span>{" "}
                รายการ
              </div>
            )} */}

            <button
              onClick={handleGoToCart}
              className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600"
            >
              ดูตะกร้าของฉัน
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
