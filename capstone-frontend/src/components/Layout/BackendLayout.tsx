import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import SideNavbar, { type SideNavbarProps } from "./SideNavbar"
import { FiMenu } from "react-icons/fi"
import { useEffect } from "react"

export default function BackendLayout({ title, menuItems }: SideNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu when route changes on mobile
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fbfaf8] text-gray-800">
      
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 shadow-sm flex-shrink-0">
        <span className="font-bold text-lg text-[#ff5a36]">{title || "KMALL"}</span>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:text-[#ff5a36] transition-colors focus:outline-none"
        >
          <FiMenu size={24} />
        </button>
      </div>

      {/* Background Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Configuration */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out bg-white shadow-xl md:shadow-none
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SideNavbar title={title} menuItems={menuItems} onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-auto md:overflow-y-auto">
          <Outlet />
      </main>
    </div>
  )
}

