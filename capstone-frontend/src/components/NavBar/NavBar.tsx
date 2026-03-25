// src/components/layout/Navbar.tsx
import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useUserStore } from "../../stores/userStore"
import { useCartApi } from "../../api/cartApi"
import { useCartStore } from "../../stores/cartStore"
import CartDropdown from "./CartDropdown"
import NotificationDropdown from "./NotificationDropdown"
import UserDropdown from "./UserDropdown"
import MobileMenu from "./MobileMenu"
import SearchBar from "./SearchBar"
import { Menu } from "lucide-react"
import kmallLogo from "../../assets/kmutt.svg"
import kmallText from "../../assets/kmutt-text.svg"
import { useNotificationApi } from "../../api/notificationApi"
import { useNotificationWebSocket } from "../../hooks/useNotificationWebSocket"

export default function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0)
  const userID = useUserStore((s) => s.id)
  const { getNotifications } = useNotificationApi()
  const [isUserOpen, setIsUserOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isNotiOpen, setIsNotiOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const location = useLocation()
  const isStoreActive = location.pathname.startsWith("/store")
  const isCartActive = location.pathname.startsWith("/orders")
  const isReportActive = location.pathname.startsWith("/reports")
  const isAddressActive = location.pathname.startsWith("/addresses")

  const { roles } = useUserStore()
  const hasSellerRole = roles?.some((r) => r.toLowerCase() === "seller")
  const storeLink = hasSellerRole ? "/store/dashboard" : "/store/register"

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
    const fetchNotiCount = async () => {
      try {
        const res = await getNotifications(10)
        const items = res.notifications ?? []
        setUnreadCount(items.filter((n) => !n.is_read).length)
      } catch (err) {
        console.error("Failed to load noti count on navbar mount", err)
      }
    }
    fetchCart()
    fetchNotiCount()
  }, [])

  // Listens for new notifications to update badge count
  useNotificationWebSocket(userID || undefined, async () => {
    try {
      const res = await getNotifications(10)
      const items = res.notifications ?? []
      setUnreadCount(items.filter((n) => !n.is_read).length)
    } catch (err) {
      console.error("Failed to refresh noti count", err)
    }
  })

  return (
    <header className="sticky top-2 md:top-4 z-50 w-full px-2 md:px-0">
      <nav className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 py-2 md:px-6 md:py-3 shadow-lg shadow-blue-50 bg-[var(--color-bg)] rounded-full ">
        {/* LEFT: Logo */}
        <Link to="/dashboard" className="cursor-pointer shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
                <img
                  src={kmallText}
                  alt="KMALL"
                className="h-6 md:h-8 w-auto hidden sm:block"
                />
            <div className="w-px h-6 md:h-8 bg-orange-500 hidden sm:block" />
                <img
                    src={kmallLogo}
                    alt="KMALL"
                    className="h-7 w-7 md:h-8 md:w-8"
                    style={{
                    filter:
                        "invert(44%) sepia(94%) saturate(3561%) hue-rotate(5deg) brightness(101%) contrast(101%)",
                }}
            />
            </div>
        </Link>

        {/* CENTER: Search (Desktop) */}
        <div className="hidden md:block flex-1 max-w-2xl mx-8">
          <SearchBar />
        </div>

        {/* RIGHT: Cart + User */}
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => {
              setIsMobileSearchOpen(!isMobileSearchOpen)
              setIsMobileMenuOpen(false)
            }}
            className="md:hidden p-2 text-gray-500 hover:text-orange-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <div className="md:block">
            <NotificationDropdown
              isOpen={isNotiOpen}
              onToggle={() => {
                setIsNotiOpen((prev) => !prev)
                setIsCartOpen(false)
                setIsUserOpen(false)
                setIsMobileSearchOpen(false)
                setIsMobileMenuOpen(false)
              }}
              onClose={() => setIsNotiOpen(false)}
            />
          </div>

          <CartDropdown
            isOpen={isCartOpen}
            onToggle={() => {
              setIsCartOpen((prev) => !prev)
              setIsNotiOpen(false)
              setIsUserOpen(false)
              setIsMobileSearchOpen(false)
              setIsMobileMenuOpen(false)
            }}
            onClose={() => setIsCartOpen(false)}
          />

          <div className="hidden md:block">
            <UserDropdown
              isOpen={isUserOpen}
              onToggle={() => {
                setIsUserOpen((prev) => !prev)
                setIsNotiOpen(false)
                setIsCartOpen(false)
                setIsMobileSearchOpen(false)
              }}
              onClose={() => setIsUserOpen(false)}
              storeLink={storeLink}
              isStoreActive={isStoreActive}
              isCartActive={isCartActive}
              isReportActive={isReportActive}
              isAddressActive={isAddressActive}
            />
          </div>

          <button
            onClick={() => {
              setIsMobileMenuOpen(true)
              setIsMobileSearchOpen(false)
              setIsCartOpen(false)
            }}
            className="md:hidden p-2 text-gray-500 hover:text-orange-500 transition-colors relative"
          >
            <Menu size={24} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* MOBILE SEARCH OVERLAY */}
      {isMobileSearchOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 mt-2 px-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white rounded-2xl shadow-xl p-2 border border-blue-50">
            <SearchBar />
          </div>
        </div>
      )}

      {/* MOBILE MENU DRAWER */}
      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        storeLink={storeLink}
        isStoreActive={isStoreActive}
        isCartActive={isCartActive}
        isReportActive={isReportActive}
        isAddressActive={isAddressActive}
        unreadNotifications={unreadCount}
      />
    </header>
  )
}
