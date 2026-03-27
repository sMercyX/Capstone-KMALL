import { useState, useRef } from "react"
import { MapPin, ChevronDown } from "lucide-react"
import { useClickOutside } from "../../hooks/useClickOutside"
import type { UserAddress } from "../../api/addressApi"

export interface Address {
  id: number
  detail: string
}

interface DeliveryAddressDropdownProps {
  value: number | null
  onChange: (addressId: number | null) => void
  addresses: UserAddress[]
  disabled?: boolean
  placeholder?: string
  label?: string
}

export default function DeliveryAddressDropdown({
  value,
  onChange,
  addresses,
  disabled = false,
  placeholder = "Select a delivery address",
  label = "Delivery Address"
}: DeliveryAddressDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempValue, setTempValue] = useState<number | null>(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setIsOpen(false))

  const selectedAddress = addresses.find(a => a.id === value)
  
  const formatAddress = (addr: UserAddress) => {
    return `${addr.label}: ${addr.address_line1} ${addr.district} ${addr.province} ${addr.postal_code}`
  }

  const displayText = selectedAddress ? formatAddress(selectedAddress) : placeholder

  const handleSelect = (id: number) => {
    setTempValue(id)
  }

  const handleConfirm = () => {
    onChange(tempValue)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempValue(value)
    setIsOpen(false)
  }

  return (
    <div>
      {label && (
        <label className="block text-base font-semibold mb-3">{label}</label>
      )}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center justify-between text-left transition-all
            ${isOpen ? "border-orange-500 ring-2 ring-orange-50" : ""}
            ${disabled ? "cursor-not-allowed opacity-70" : "hover:border-gray-300 cursor-pointer shadow-sm"}`}
        >
          <div className="flex items-center gap-3 overflow-hidden flex-1">
             <MapPin className="w-5 h-5 text-[#f0532c] shrink-0" />
             <span className={`text-[15px] font-semibold truncate ${selectedAddress ? "text-[#f0532c]" : "text-gray-400"}`}>
                {displayText}
             </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        
        {isOpen && !disabled && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-80 overflow-auto">
            {addresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => handleSelect(addr.id)}
                className={`w-full text-left px-5 py-3.5 hover:bg-gray-50 border-l-4 transition-colors text-sm
                  ${tempValue === addr.id 
                    ? "bg-orange-50 text-[#f0532c] border-[#f0532c] font-semibold" 
                    : "border-transparent text-gray-600"}`}
              >
                {formatAddress(addr)}
              </button>
            ))}
            {addresses.length === 0 && (
                <div className="p-4 py-8 text-center text-gray-500 text-sm">Shipping address not provided</div>
            )}
            <div className="flex justify-end gap-2 p-3 border-t sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
