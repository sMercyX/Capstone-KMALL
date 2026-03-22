import { useState, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { useClickOutside } from "../../hooks/useClickOutside"

export interface DropdownOption<T> {
  id: T
  name: string
}

interface DropdownProps<T> {
  label: string
  options: DropdownOption<T>[]
  value: T
  onChange: (val: T) => void
  disabled?: boolean
  icon?: React.ReactNode
  className?: string
  placeholder?: string
  allLabel?: string | null // Pass null to hide the "All" option
}

export function Dropdown<T extends string | number>({ 
  label, 
  options, 
  value, 
  onChange, 
  disabled, 
  icon, 
  className = "w-full",
  placeholder,
  allLabel 
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, () => setIsOpen(false))

  const selectedOption = options.find(opt => opt.id === value)
  
  // Logic for display label
  let displayLabel = placeholder || label
  if (value !== undefined && value !== null && value !== "" && value !== "ALL") {
    displayLabel = selectedOption?.name || String(value)
  }

  const finalAllLabel = allLabel === undefined ? `All ${label}` : allLabel

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-4 rounded-xl border bg-white shadow-sm transition-all duration-300 text-sm font-medium cursor-pointer ${
          disabled 
            ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400" 
            : "border-gray-100 text-gray-700 hover:border-[#ff5a36]/40 hover:shadow-md hover:shadow-orange-100/20"
        } ${isOpen ? "border-[#ff5a36] ring-4 ring-orange-50/50 shadow-md shadow-orange-100/30" : ""}`}
      >
        <div className="flex items-center gap-3 truncate">
          {icon && <span className={`${isOpen ? "text-[#ff5a36]" : "text-gray-400"} transition-colors duration-300`}>{icon}</span>}
          <span className={`truncate ${value !== undefined && value !== null && value !== "" && value !== "ALL" ? "text-gray-900 font-bold" : "text-gray-400"}`}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#ff5a36]" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 origin-top">
          <div className="max-h-[320px] overflow-y-auto pr-1 mr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {allLabel !== null && (
              <button
                type="button"
                onClick={() => {
                  onChange("ALL" as unknown as T)
                  setIsOpen(false)
                }}
                className={`flex items-center justify-between w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50/50 mb-1 hover:bg-orange-50/40 ${
                  value === ("ALL" as unknown as T) ? "text-[#ff5a36] font-bold bg-orange-50/30" : "text-gray-600"
                }`}
              >
                <span>{finalAllLabel}</span>
                {value === ("ALL" as unknown as T) && <div className="w-1.5 h-1.5 rounded-full bg-[#ff5a36]" />}
              </button>
            )}
            <div className="px-1.5 space-y-0.5">
              {options.map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                  }}
                  className={`flex items-center justify-between w-full text-left px-3 py-2.5 text-sm transition-all rounded-lg hover:bg-orange-50/40 group ${
                    value === opt.id ? "text-[#ff5a36] font-bold bg-orange-50/30 shadow-sm shadow-orange-100/10" : "text-gray-600"
                  }`}
                >
                  <span className="truncate group-hover:translate-x-0.5 transition-transform duration-200">{opt.name}</span>
                  {value === opt.id && (
                    <div className="flex items-center">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#ff5a36]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {options.length === 0 && (
               <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                  No options found
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
