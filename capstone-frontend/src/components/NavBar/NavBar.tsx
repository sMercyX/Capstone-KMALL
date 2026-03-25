// src/components/layout/Navbar.tsx
import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useUserStore } from "../../stores/userStore"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import CartDropdown from "./CartDropdown"
import NotificationDropdown from "./NotificationDropdown"
import UserDropdown from "./UserDropdown"
import SearchBar from "./SearchBar"
import kmallLogo from "../../assets/kmutt.svg"
import kmallText from "../../assets/kmutt-text.svg"

export default function Navbar() {
  const [isUserOpen, setIsUserOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isNotiOpen, setIsNotiOpen] = useState(false)

  const location = useLocation()
  const isStoreActive = location.pathname.startsWith("/store")
  const isCartActive = location.pathname.startsWith("/orders")
  const isReportActive = location.pathname.startsWith("/reports")
  const isAddressActive = location.pathname.startsWith("/addresses")

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
        <Link to="/dashboard" className="cursor-pointer">
            <div className="flex items-center gap-3">
                <img
                  src={kmallText}
                  alt="KMALL"
                className="h-8 w-auto"
                />
            <div className="w-px h-8 bg-orange-500" />
                <img
                    src={kmallLogo}
                    alt="KMALL"
                    className="h-8 w-8"
                    style={{
                    filter:
                        "invert(44%) sepia(94%) saturate(3561%) hue-rotate(5deg) brightness(101%) contrast(101%)",
                }}
            />
            </div>
        </Link>

        {/* CENTER: Search */}
        <SearchBar />

        {/* RIGHT: Cart + User */}
        <div className="flex items-center gap-4">
          <NotificationDropdown
            isOpen={isNotiOpen}
            onToggle={() => {
              setIsNotiOpen((prev) => !prev)
              setIsCartOpen(false)
              setIsUserOpen(false)
            }}
            onClose={() => setIsNotiOpen(false)}
          />

          <CartDropdown
            isOpen={isCartOpen}
            onToggle={() => {
              setIsCartOpen((prev) => !prev)
              setIsNotiOpen(false)
              setIsUserOpen(false)
            }}
            onClose={() => setIsCartOpen(false)}
          />

          <UserDropdown
            isOpen={isUserOpen}
            onToggle={() => {
              setIsUserOpen((prev) => !prev)
              setIsNotiOpen(false)
              setIsCartOpen(false)
            }}
            onClose={() => setIsUserOpen(false)}
            storeLink={storeLink}
            isStoreActive={isStoreActive}
            isCartActive={isCartActive}
            isReportActive={isReportActive}
            isAddressActive={isAddressActive}
          />
        </div>
      </nav>
    </header>
  )
}
