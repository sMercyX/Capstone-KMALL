import { Outlet } from "react-router-dom"
import SideNavbar, { type SideNavbarProps } from "./SideNavbar"

export default function BackendLayout({ title, menuItems }: SideNavbarProps) {
  return (
    <div className="min-h-screen flex bg-[#fbfaf8] text-gray-800">
      {/* Dynamic Sidebar Configuration */}
      <SideNavbar title={title} menuItems={menuItems} />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
