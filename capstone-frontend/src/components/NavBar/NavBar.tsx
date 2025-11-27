// src/components/layout/Navbar.tsx
import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ShoppingCart, User, ChevronDown, Image, Check, X } from "lucide-react"
import { useUserStore } from "../../stores/userStore"
import { useTheme } from "../../theme/ThemeContext"
import { useCartStore } from "../../stores/cartStore"
import { useCartApi } from "../../api/cartApi"

export default function Navbar() {
  const [isUserOpen, setIsUserOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const isStoreActive = location.pathname.startsWith("/store")
  const isCartActive = location.pathname.startsWith("/orders")

  const { name, email, roles } = useUserStore()

  // CART STATE + API
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
    if (!isCartOpen) return
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
  }, [
    isCartOpen,
    cart,
    cartLoading,
    getCart,
    setCart,
    setCartError,
    startCartLoading,
  ])

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

  // เช็ค role seller
  const hasSellerRole = roles?.some((r) => r.toLowerCase() === "seller")
  const storeLink = hasSellerRole ? "/store/me" : "/store/register"

  const handleGoToCart = () => {
    setIsCartOpen(false)
    navigate("/cart")
  }

  return (
    <header className="sticky top-4 z-50 w-full bg-[--color-primary]">
      <nav className="max-w-[calc(100%-110px)] mx-auto flex items-center justify-between px-6 py-3 shadow-lg shadow-blue-50 bg-[var(--color-bg)] rounded-full ">
        {/* LEFT: Logo */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-2xl font-bold text-orange-600">
            KMALL
          </Link>
          <img src="/kmutt-logo.png" alt="KMUTT" className="h-8 w-8" />
        </div>

        {/* CENTER: Search */}
        <div className="flex justify-center w-[50%]">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full rounded-full border border-gray-300 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* RIGHT: Cart + User */}
        <div className="flex items-center gap-4">
          {/* CART */}
          <div className="relative">
            <button
              className="relative cursor-pointer"
              onClick={() => {
                setIsCartOpen((prev) => !prev)
                setIsUserOpen(false)
              }}
            >
              <ShoppingCart className="h-6 w-6 text-[--icon-color] hover:text-orange-600" />
              {totalQuantity > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full px-1.5">
                  {totalQuantity}
                </span>
              )}
            </button>

            {isCartOpen && (
              <div className="absolute right-0 mt-3 w-[360px] rounded-3xl bg-white shadow-xl border border-orange-200 p-5 z-50">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-orange-500" />
                    <span className="font-semibold text-gray-900">
                      ตะกร้าทั้งหมด ({totalQuantity})
                    </span>
                  </div>
                  <button onClick={() => setIsCartOpen(false)}>
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>

                <div className="h-[1px] bg-gray-100 mb-3" />

                <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-center text-gray-700">
                  ตะกร้าของคุณ
                </div>

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
                        {/* Checkbox (fix เป็นเลือกทั้งหมดก่อน) */}
                        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-orange-500 bg-orange-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>

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
                  <div className="text-sm text-gray-600">
                    รวมทั้งหมด{" "}
                    <span className="font-semibold text-gray-900">
                      {totalQuantity}
                    </span>{" "}
                    รายการ
                  </div>

                  <button
                    onClick={handleGoToCart}
                    className="w-full rounded-full bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600"
                  >
                    สั่งสินค้า
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* USER DROPDOWN */}
          <div className="relative">
            <button
              className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-100"
              onClick={() => {
                setIsUserOpen((prev) => !prev)
                setIsCartOpen(false)
              }}
            >
              <User className="h-5 w-5 text-gray-700" />
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {isUserOpen && (
              <div className="absolute right-0 mt-3 w-80 rounded-3xl bg-white shadow-xl border border-violet-200 p-5 z-50">
                {/* Profile header */}
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {name}
                    </p>
                    <p className="text-xs text-gray-500">{email}</p>

                    {/* Theme toggle */}
                    <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 text-xs">
                      <button
                        className={`px-3 py-1 rounded-full ${
                          theme === "dark"
                            ? "bg-gray-900 text-white shadow"
                            : "text-gray-600"
                        }`}
                        onClick={() => setTheme("dark")}
                      >
                        Dark
                      </button>
                      <button
                        className={`px-3 py-1 rounded-full ${
                          theme === "light"
                            ? "bg-white text-gray-800 shadow"
                            : "text-gray-500"
                        }`}
                        onClick={() => setTheme("light")}
                      >
                        Light
                      </button>
                    </div>
                  </div>
                </div>

                {/* Menu */}
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
                  <Link
                    to={storeLink}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:text-orange-500! transition-colors
                    ${
                      isStoreActive
                        ? "bg-white text-black font-medium"
                        : "text-gray-500! hover:bg-white"
                    }
                  `}
                    onClick={() => setIsUserOpen(false)}
                  >
                    <div className="flex items-center gap-2 ">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Image className="h-4 w-4 text-gray-400" />
                      </span>
                      <span >
                        {hasSellerRole ? "ร้านค้าของฉัน" : "เปิดร้านค้าของฉัน"}
                      </span>
                    </div>

                    {isStoreActive && (
                      <Check className="h-4 w-4 text-orange-500" />
                    )}
                  </Link>

                  <Link
                    to="/orders/ongoing"
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:text-orange-500! transition-colors
                    ${
                      isCartActive
                        ? "bg-white text-black font-medium"
                        : "text-gray-500! hover:bg-white"
                    }
                  `}
                    onClick={() => setIsUserOpen(false)}
                  >
                    <div className="flex items-center gap-2 ">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Image className="h-4 w-4 text-gray-400" />
                      </span>
                      <span >การซื้อของฉัน</span>
                    </div>

                    {isCartActive && (
                      <Check className="h-4 w-4 text-orange-500" />
                    )}
                  </Link>

                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-500 hover:bg-white cursor-pointer hover:text-orange-500"
                    onClick={() => {
                      setIsUserOpen(false)
                      // TODO: logout
                    }}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                      <Image className="h-4 w-4 text-gray-400" />
                    </span>
                    <span >ออกจากระบบ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
