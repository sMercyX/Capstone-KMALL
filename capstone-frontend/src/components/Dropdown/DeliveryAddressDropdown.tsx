// src/components/Dropdown/DeliveryAddressDropdown.tsx
import { useState, useRef } from "react"
import { useClickOutside } from "../../hooks/useClickOutside"

export interface Address {
  id: number
  detail: string
}

interface DeliveryAddressDropdownProps {
  value: number | null
  onChange: (addressId: number | null) => void
  addresses: Address[]
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
  const displayText = selectedAddress ? selectedAddress.detail : placeholder

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
          className={`w-full bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between text-left
            ${isOpen ? 'border-orange-500' : ''}
            ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-gray-300 cursor-pointer'}`}
        >
          <span className={`text-base ${selectedAddress ? 'text-gray-900' : 'text-gray-400'}`}>
            {displayText}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && !disabled && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-80 overflow-auto">
            {addresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => handleSelect(addr.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-l-4 transition-colors
                  ${tempValue === addr.id 
                    ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' 
                    : 'border-transparent'}`}
              >
                {addr.detail}
              </button>
            ))}
            {addresses.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">ไม่มีที่อยู่จัดส่ง</div>
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
