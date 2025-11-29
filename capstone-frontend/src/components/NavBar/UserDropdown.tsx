import { Link } from "react-router-dom"
import { ChevronDown, User, Image, Check } from "lucide-react"
import { useTheme } from "../../theme/ThemeContext"
import { useUserStore } from "../../stores/userStore"
import { useAuth } from "../../auth/AuthContext"

type Props = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  storeLink: string
  isStoreActive: boolean
  isCartActive: boolean
}

export default function UserDropdown({
  isOpen,
  onToggle,
  onClose,
  storeLink,
  isStoreActive,
  isCartActive,
}: Props) {
  const { theme, setTheme } = useTheme()
  const { name, email } = useUserStore()
  const { logout } = useAuth()

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-100"
        onClick={onToggle}
      >
        <User className="h-5 w-5 text-gray-700" />
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
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
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                ${
                  isStoreActive
                    ? "bg-white text-black font-medium"
                    : "text-gray-500 hover:bg-white"
                }
              `}
              onClick={onClose}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <Image className="h-4 w-4 text-gray-400" />
                </span>
                <span>ร้านค้าของฉัน</span>
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
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <Image className="h-4 w-4 text-gray-400" />
                </span>
                การซื้อของฉัน
              </div>

              {isCartActive && <Check className="h-4 w-4 text-orange-500" />}
            </Link>

            <button
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-500 hover:bg-white"
              onClick={() => {
                logout()
                onClose()
              }}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                <Image className="h-4 w-4 text-gray-400" />
              </span>
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
