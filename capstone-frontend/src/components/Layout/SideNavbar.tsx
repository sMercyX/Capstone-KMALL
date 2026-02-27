import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import kmallText from "../../assets/kmutt-text.svg"

export interface SubMenuItem {
  label: string
  path: string
}

export interface MenuItem {
  label: string
  icon: React.ReactNode
  path?: string // For direct links
  subItems?: SubMenuItem[] // For dropdown menus
}

export interface SideNavbarProps {
  title?: string
  menuItems: MenuItem[]
}

export default function SideNavbar({ title, menuItems }: SideNavbarProps) {
  const location = useLocation()
  
  // Keep track of which dropdowns are open
  // Intentionally defaulting to open if the current path matches a subitem
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    menuItems.forEach(item => {
      if (item.subItems) {
        // Auto-open if we are currently on one of the sub-items
        const isActive = item.subItems.some(subItem => location.pathname.startsWith(subItem.path))
        initialState[item.label] = isActive
      }
    })
    return initialState
  })

  const toggleDropdown = (label: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [label]: !prev[label]
    }))
  }

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      {/* Header Logo & Badge */}
      <div className="flex flex-col items-center pt-8 pb-6 border-b border-gray-100">
        <img src={kmallText} alt="KMALL" className={`h-10 ${title ? 'mb-6' : ''}`} />
        {title && (
          <div className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium text-sm w-[200px] text-center shadow-sm">
            {title}
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.label}>
            {item.subItems ? (
              // Collapsible Dropdown Item
              <div className="mb-2">
                <button
                  onClick={() => toggleDropdown(item.label)}
                  className={`w-full cursor-pointer flex items-center justify-between px-4 py-3 rounded-lg transition-colors group relative
                    ${
                      item.subItems.some((sub) => location.pathname.startsWith(sub.path))
                        ? "text-primary font-medium"
                        : "text-secondary hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                >
                  {/* Active Left Indicator Layer for Collapsible parents */}
                  {item.subItems.some((sub) => location.pathname.startsWith(sub.path)) && (
                    <div className="absolute -left-4 top-0 bottom-0 w-1.5 bg-[var(--color-primary)] rounded-r-md"></div>
                  )}
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-2xl ${
                        item.subItems.some((sub) => location.pathname.startsWith(sub.path))
                          ? "text-primary"
                          : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-lg">{item.label}</span>
                  </div>
                  <span
                    className={`text-xl transition-transform duration-200 ${
                      item.subItems.some((sub) => location.pathname.startsWith(sub.path))
                        ? "text-primary"
                        : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  >
                    {openDropdowns[item.label] ? <FaChevronUp /> : <FaChevronDown />}
                  </span>
                </button>

                {/* Dropdown Content */}
                {openDropdowns[item.label] && (
                  <div className="mt-1 ml-[3.25rem] space-y-1 relative ">
                    {/* Vertical connector line */}
                    <div className="absolute left-[-1.5rem] top-0 bottom-4 w-px bg-gray-200 "></div>
                    
                    {item.subItems.map((subItem) => (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        className={({ isActive }) =>
                          `block py-2 text-lg transition-colors relative ${
                            isActive
                              ? "text-primary font-semibold"
                              : "text-secondary hover:text-gray-800"
                          }`
                        }
                      >
                        <>
                          {/* Horizontal connector dot */}
                          <div className="absolute left-[-1.5rem] top-1/2 -translate-y-1/2 w-3 h-px bg-gray-200"></div>
                          <span className="flex items-center text-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2 opacity-0"></span>
                            {subItem.label}
                          </span>
                        </>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Direct Link Item
              <NavLink
                to={item.path!}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors relative group mb-1
                    ${
                      isActive
                        ? "text-primary font-semibold"
                        : "text-secondary hover:text-gray-900 hover:bg-gray-50"
                    }
                  `
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active Left Indicator Layer */}
                    {isActive && (
                      <div className="absolute -left-4 top-0 bottom-0 w-1.5 bg-[var(--color-primary)] rounded-r-md"></div>
                    )}
                    <span
                      className={`text-2xl ${
                        isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-lg">{item.label}</span>
                  </>
                )}
              </NavLink>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
