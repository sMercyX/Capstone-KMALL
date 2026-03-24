import { useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, User, Image, Check } from "lucide-react"
// import { useTheme } from "../../theme/ThemeContext"
import { useUserStore } from "../../stores/userStore"
import { useAuth } from "../../auth/AuthContext"
import ThemeSwitch2 from "../ThemeSwitch/ThemeSwitch2"

type Props = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  storeLink: string
  isStoreActive: boolean
  isCartActive: boolean
  isReportActive: boolean
}

export default function UserDropdown({
  isOpen,
  onToggle,
  onClose,
  storeLink,
  isStoreActive,
  isCartActive,
  isReportActive,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement | null>(null)

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
  // const { theme, setTheme } = useTheme()
  const { name, email, roles } = useUserStore()
  const { logout } = useAuth()

  const getDisplayRole = () => {
    if (!roles || roles.length === 0) return "Guest"
    if (roles.includes("admin")) return "Admin"
    if (roles.includes("seller")) return "Seller"
    return "Buyer"
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 rounded-full border border-gray-300 text-gray-700 px-3 py-1 hover:bg-gray-100  cursor-pointer"
        onClick={onToggle}
      >
        <User className={`h-5 w-5 ${isOpen ? "text-orange-500" : "text-gray-500"}`} />
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="absolute right-0 mt-3 w-80 rounded-3xl bg-white shadow-xl border border-orange-200 p-5 z-50">
          {/* Profile header */}
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {name}
              </p>
              <p className="text-xs text-gray-500">{email}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {getDisplayRole()}
              </p>
              {/* Theme toggle */}
              <ThemeSwitch2/>
              {/* <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 text-xs">
                <button
                  className={`px-3 py-1 rounded-full cursor-pointer ${
                    theme === "dark"
                      ? "bg-gray-900 text-white shadow"
                      : "text-gray-600"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </button>
                <button
                  className={`px-3 py-1 rounded-full cursor-pointer ${
                    theme === "light"
                      ? "bg-white text-gray-800 shadow"
                      : "text-gray-500"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  Light
                </button>
              </div> */}
            </div>
          </div>

          {/* Menu */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
            {roles?.includes("admin") && (
              <Link
                to="/admin"
                target="_blank"
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm text-gray-500 hover:bg-white`}
                onClick={onClose}
              >
                <div className={`flex items-center gap-2 text-gray-500`}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                    <Image className="h-4 w-4 text-gray-400" />
                  </span>
                  <span>Admin Panel</span>
                </div>
              </Link>
            )}

            <Link
              to={storeLink}
              target="_blank"
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                ${
                  isStoreActive
                    ? "bg-white text-black font-medium"
                    : "text-gray-500 hover:bg-white"
                }
              `}
              onClick={onClose}
            >
              <div className={`flex items-center gap-2 text-gray-500 ${isStoreActive ? "text-orange-500" : "" }`}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <Image className="h-4 w-4 text-gray-400" />
                </span>
                <span>My Store</span>
              </div>

              {isStoreActive && <Check className="h-4 w-4 text-orange-500" />}
            </Link>

            <Link
              to="/orders/ongoing"
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                ${
                  isCartActive
                    ? "bg-white text-black font-medium"
                    : "text-gray-500 hover:bg-white"
                }
              `}
              onClick={onClose}
            >
              <div className={`flex items-center gap-2 text-gray-500 ${isCartActive ? "text-orange-500" : "" }`}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <Image className="h-4 w-4 text-gray-400" />
                </span>
                My Orders
              </div>

              {isCartActive && <Check className="h-4 w-4 text-orange-500" />}
            </Link>

            <Link
              to="/reports"
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                ${
                  isReportActive
                    ? "bg-white text-black font-medium"
                    : "text-gray-500 hover:bg-white"
                }
              `}
              onClick={onClose}
            >
              <div className={`flex items-center gap-2 text-gray-500 ${isReportActive ? "text-orange-500" : "" }`}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <Image className="h-4 w-4 text-gray-400" />
                </span>
                My Reports
              </div>

              {isReportActive && <Check className="h-4 w-4 text-orange-500" />}
            </Link>

            <button
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-500 hover:bg-white cursor-pointer"
              onClick={() => {
                logout()
                onClose()
              }}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                <Image className="h-4 w-4 text-gray-400" />
              </span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
