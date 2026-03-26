import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingCart, X } from "lucide-react"
import { toast } from "react-toastify"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import ConfirmationModal from "../Modal/ConfirmationModal"
import { resolveImageUrl } from "../../utils/resolve"



type Props = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export default function CartDropdown({ isOpen, onToggle, onClose }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

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
        setCartError("Unable to load your cart.")
      }
    })()
  }, [isOpen, cart, cartLoading, getCart, setCart, setCartError, startCartLoading])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])


  async function handleDeleteClick(id: number) {
    setItemToDelete(id)
    setIsConfirmModalOpen(true)
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return

    try {
      setDeletingId(itemToDelete)
      await deleteItemCart(itemToDelete)
      const res = await getCart()
      setCart(res.data)
      toast.success("Item removed from your cart.")
    } catch (err) {
      console.error("Failed to delete cart item", err)
      setCartError("Unable to remove the item.")
    } finally {
      setDeletingId(null)
      setItemToDelete(null)
      setIsConfirmModalOpen(false)
    }
  }

  const handleGoToCart = () => {
    onClose()
    navigate("/checkout")
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="relative cursor-pointer p-2 text-gray-500 hover:text-orange-500 transition-colors"
        onClick={onToggle}
      >
        <ShoppingCart className={`h-6 w-6 ${isOpen ? "text-orange-500" : ""}`} />
        {/* <ShoppingCart className="h-6 w-6 text-[--icon-color] hover:text-orange-600" />  */}
        {totalQuantity > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white">
            {totalQuantity}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed inset-x-4 top-24 bg-white shadow-2xl p-5 z-50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200
                     md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 md:w-[360px] md:rounded-3xl md:border md:border-orange-200 md:shadow-xl md:bg-white md:animate-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-gray-900">
                Cart Items ({totalQuantity})
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
                Loading items...
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
                  Your cart is empty.
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
                        src={resolveImageUrl(item.product_image_url)}
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
                    {item.variant_label && (
                      <p className="text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded-full w-fit mt-0.5">
                        {item.variant_label}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      Quantity: {item.quantity}
                    </p>
                    {item.note && (
                      <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 italic">
                        Note: {item.note}
                      </p>
                    )}
                  </div>

                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 shadow-md shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDeleteClick(item.id)}
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

            
            {
              (cart && cart.items.length > 0) && (
                <button
              onClick={handleGoToCart}
              className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600 transition-all active:scale-95"
            >
              Review & Checkout
            </button>
              )}
          </div>
        </div>
      )}
      {/* Modal Confirm Delete */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        title="Remove item from cart?"
        message="Are you sure you want to remove this item from your cart?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onClose={() => setIsConfirmModalOpen(false)}
        variant="danger"
      />
    </div>
  )
}
