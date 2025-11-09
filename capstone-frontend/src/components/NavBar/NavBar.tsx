import { useState } from "react"
import { Link } from "react-router-dom"
import { ShoppingCart, User, ChevronDown, Search } from "lucide-react"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-4 z-50 w-full ">
      <nav className="max-w-[calc(100%-110px)] mx-auto flex items-center justify-between px-6 py-3 shadow-sm shadow-blue-50">
        {/* ==== LEFT: Logo ==== */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-2xl font-bold text-orange-600">
            KMALL
          </Link>
          <img
            src="/kmutt-logo.png" // ✅ ใส่โลโก้ KMUTT ของคุณใน public/
            alt="KMUTT"
            className="h-8 w-8"
          />
        </div>

        {/* ==== CENTER: Search bar ==== */}
        <div className="flex-1 mx-8">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full rounded-full border border-gray-300 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
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
              onClick={() => setIsOpen(!isOpen)}
            >
              <User className="h-5 w-5 text-gray-700" />
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-md z-10">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/orders"
                  className="block px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  My Orders
                </Link>
                <hr />
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
