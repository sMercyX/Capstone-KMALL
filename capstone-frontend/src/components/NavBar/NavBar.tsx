import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ShoppingCart, User, ChevronDown, Image, Check } from "lucide-react"
import { useUserStore } from "../../stores/userStore"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  const location = useLocation()
  const isStoreActive = location.pathname.startsWith("/store")
  const isCartActive = location.pathname.startsWith("/orders")

  const { name, email, role } = useUserStore()

  return (
    <header className="sticky top-4 z-50 w-full bg-[--color-primary]">
      <nav className="max-w-[calc(100%-110px)] mx-auto flex items-center justify-between px-6 py-3 shadow-lg shadow-blue-50 bg-[var(--color-bg)] rounded-full ">
        {/* ==== LEFT: Logo ==== */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-2xl font-bold text-orange-600">
            KMALL
          </Link>
          <img src="/kmutt-logo.png" alt="KMUTT" className="h-8 w-8" />
        </div>

        {/* ==== CENTER: Search bar ==== */}
        <div className="flex justify-center w-[50%]">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full rounded-full border border-gray-300 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* ==== RIGHT: Cart + User ==== */}
        <div className="flex items-center gap-4">
          {/* Cart */}
          <div className="relative cursor-pointer">
            <ShoppingCart className="h-6 w-6 text-[--icon-color] hover:text-orange-600" />
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full px-1.5">
              2
            </span>
          </div>

          {/* User Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-100"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              <User className="h-5 w-5 text-gray-700" />
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-3 w-80 rounded-3xl bg-white shadow-xl border border-violet-200 p-5 z-50">
                {/* Profile Header */}
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {name}
                    </p>
                    <p className="text-xs text-gray-500">{email}</p>
                    <p className="text-xs text-gray-500">{role}</p>
                    {/* Theme Toggle */}
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

                {/* Menu Card */}
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
                  {/* ร้านค้าของฉัน (active) */}
                  <Link
                    to="/store/me"
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                    ${
                      isStoreActive
                        ? "bg-white text-black font-medium"
                        : "text-gray-500 hover:bg-white"
                    }
                  `}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center gap-2 ">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Image className="h-4 w-4 text-gray-400" />
                      </span>
                      ร้านค้าของฉัน
                    </div>

                    {isStoreActive && (
                      <Check className="h-4 w-4 text-orange-500" />
                    )}
                  </Link>

                  {/* การซื้อของฉัน */}
                  <Link
                    to="/orders"
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm
                    ${
                      isCartActive
                        ? "bg-white text-black font-medium"
                        : "text-gray-500 hover:bg-white"
                    }
                  `}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center gap-2 ">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Image className="h-4 w-4 text-gray-400" />
                      </span>
                      การซื้อของฉัน
                    </div>

                    {isCartActive && (
                      <Check className="h-4 w-4 text-orange-500" />
                    )}
                  </Link>

                  {/* ออกจากระบบ */}
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-500 hover:bg-white"
                    onClick={() => {
                      setIsOpen(false)
                      // TODO: ใส่ logic logout จริง
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
        </div>
      </nav>
    </header>
  )
}
