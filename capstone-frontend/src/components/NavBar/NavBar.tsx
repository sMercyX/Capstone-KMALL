// src/components/layout/Navbar.tsx
import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useUserStore } from "../../stores/userStore"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import CartDropdown from "./CartDropdown"
import UserDropdown from "./UserDropdown"

export default function Navbar() {
  const [isUserOpen, setIsUserOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  const location = useLocation()
  const isStoreActive = location.pathname.startsWith("/store")
  const isCartActive = location.pathname.startsWith("/orders")

  const { roles } = useUserStore()
  const hasSellerRole = roles?.some((r) => r.toLowerCase() === "seller")
  const storeLink = hasSellerRole ? "/store/me" : "/store/register"

  const { getCart } = useCartApi()
  const { setCart } = useCartStore()

  // Load cart on mount (refresh)
  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await getCart()
        setCart(res.data)
      } catch (err) {
        console.error("Failed to load cart on navbar mount", err)
      }
    }
    fetchCart()
  }, [])

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
        {/* <div className="flex justify-center w-[50%]">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full rounded-full border border-gray-300 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div> */}

        {/* RIGHT: Cart + User */}
        <div className="flex items-center gap-4">
          <CartDropdown
            isOpen={isCartOpen}
            onToggle={() => {
              setIsCartOpen((prev) => !prev)
              setIsUserOpen(false)
            }}
            onClose={() => setIsCartOpen(false)}
          />

          <UserDropdown
            isOpen={isUserOpen}
            onToggle={() => {
              setIsUserOpen((prev) => !prev)
              setIsCartOpen(false)
            }}
            onClose={() => setIsUserOpen(false)}
            storeLink={storeLink}
            isStoreActive={isStoreActive}
            isCartActive={isCartActive}
          />
        </div>
      </nav>
    </header>
  )
}
