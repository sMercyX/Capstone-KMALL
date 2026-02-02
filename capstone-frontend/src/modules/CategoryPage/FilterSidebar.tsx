import { Check, ChevronUp } from "lucide-react"
import { useState, useEffect } from "react"
import Slider from "rc-slider"
import "rc-slider/assets/index.css"

interface FilterSidebarProps {
  filterOptions: { label: string; value: string; count?: number }[]
  selectedCategories: number[]
  onChangeCategory: (ids: number[]) => void
  onClearAll?: () => void
  // Price range props (UI only for now)
  priceMin?: number
  priceMax?: number
  onChangePriceRange?: (min: number, max: number) => void
  maxPriceLimit?: number
}

// Section Card wrapper
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export default function FilterSidebar({
  filterOptions,
  selectedCategories,
  onChangeCategory,
  onClearAll,
  priceMin = 15,
  priceMax = 250,
  onChangePriceRange,
  maxPriceLimit = 500
}: FilterSidebarProps) {
  
  // Local state for price range
  const [priceRange, setPriceRange] = useState<[number, number]>([priceMin, priceMax])

  // Sync state with props when data loads
  useEffect(() => {
    setPriceRange([priceMin, maxPriceLimit])
  }, [priceMin, maxPriceLimit])

  // Collapsible sections state
  const [isCategoryOpen, setIsCategoryOpen] = useState(true)
  const [isPriceOpen, setIsPriceOpen] = useState(true)
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(true)

  const handleCategoryToggle = (idStr: string) => {
    const id = Number(idStr)
    const newSelected = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id]
    onChangeCategory(newSelected)
  }

  const handlePriceChange = (value: number | number[]) => {
    if (Array.isArray(value)) {
      setPriceRange([value[0], value[1]])
    }
  }

  const handlePriceChangeComplete = (value: number | number[]) => {
    if (Array.isArray(value) && onChangePriceRange) {
      onChangePriceRange(value[0], value[1])
    }
  }

  const handleClearAll = () => {
    onChangeCategory([])
    setPriceRange([0, maxPriceLimit])
    if (onClearAll) onClearAll()
  }

  return (
    <div className="space-y-4">
      {/* Header & Clear Button */}
      <SectionCard>
        <h2 className="text-lg font-bold text-gray-900 mb-4">ตัวกรองสินค้า</h2>
        <button 
          onClick={handleClearAll}
          className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 transition"
        >
          ลบการกรองสินค้าทั้งหมด
        </button>
      </SectionCard>

      {/* Categories Section */}
      <SectionCard>
        <button 
          onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900">หมวดหมู่</span>
          <ChevronUp className={`h-4 w-4 text-gray-500 transition-transform ${isCategoryOpen ? '' : 'rotate-180'}`} />
        </button>
        
        {isCategoryOpen && (
          <div className="mt-4 space-y-1">
            {/* Category Label */}
            {/* <p className="text-sm font-semibold text-gray-800 mb-3">อาหาร</p> */}
            
            {filterOptions.map((opt) => {
              const isSelected = selectedCategories.includes(Number(opt.value))
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center justify-between py-2 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      flex h-6 w-6 items-center justify-center rounded-lg border-2 transition
                      ${isSelected 
                        ? "border-orange-500 bg-orange-500 text-white" 
                        : "border-gray-300 bg-white group-hover:border-gray-400"}
                    `}>
                      {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(opt.value)}
                      />
                    </div>
                    <span className={`text-sm ${isSelected ? "text-orange-600 font-medium" : "text-gray-600"}`}>
                      {opt.label}
                    </span>
                  </div>
                  {/* Count */}
                  <span className="text-sm text-gray-400">{opt.count ?? ""}</span>
                </label>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Price Range Section */}
      <SectionCard>
        <button 
          onClick={() => setIsPriceOpen(!isPriceOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900">ช่วงราคา</span>
          <ChevronUp className={`h-4 w-4 text-gray-500 transition-transform ${isPriceOpen ? '' : 'rotate-180'}`} />
        </button>

        {isPriceOpen && (
          <div className="mt-6 space-y-4">
            {/* Min/Max labels above slider */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white min-w-[50px] text-center">
                {priceRange[0]}
              </span>
              <span className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white min-w-[50px] text-center">
                {priceRange[1]}
              </span>
            </div>

            {/* Functional Slider */}
            <div className="px-2">
              <Slider
                range
                min={0}
                max={maxPriceLimit}
                value={priceRange}
                onChange={handlePriceChange}
                onChangeComplete={handlePriceChangeComplete}
                styles={{
                  track: { backgroundColor: '#f97316', height: 6 },
                  handle: { 
                    backgroundColor: '#f97316', 
                    borderColor: '#f97316',
                    width: 18,
                    height: 18,
                    marginTop: -6,
                    opacity: 1,
                  },
                  rail: { backgroundColor: '#e5e7eb', height: 6 },
                }}
              />
            </div>

            {/* Input boxes */}
            <div className="flex items-center gap-4 pt-2">
              <input 
                type="number" 
                value={priceRange[0]}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val >= 0 && val <= priceRange[1]) {
                    setPriceRange([val, priceRange[1]])
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-center font-medium focus:border-orange-500 focus:outline-none"
              />
              <input 
                type="number" 
                value={priceRange[1]}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val >= priceRange[0] && val <= maxPriceLimit) {
                    setPriceRange([priceRange[0], val])
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-center font-medium focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Delivery Options Section */}
      <SectionCard>
        <button 
          onClick={() => setIsDeliveryOpen(!isDeliveryOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900">ตัวเลือกการจัดส่ง</span>
          <ChevronUp className={`h-4 w-4 text-gray-500 transition-transform ${isDeliveryOpen ? '' : 'rotate-180'}`} />
        </button>

        {isDeliveryOpen && (
          <div className="mt-4 space-y-2">
            <label className="flex cursor-pointer items-center justify-between py-2 group">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-orange-500 bg-orange-500">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </div>
                <span className="text-sm text-orange-600 font-medium">นัดรับใน มจธ.</span>
              </div>
              <span className="text-sm text-gray-400">11</span>
            </label>
            <label className="flex cursor-pointer items-center justify-between py-2 group">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-lg border-2 border-gray-300 group-hover:border-gray-400"></div>
                <span className="text-sm text-gray-600">ส่งรอบมอ</span>
              </div>
              <span className="text-sm text-gray-400">23</span>
            </label>
          </div>
        )}
      </SectionCard>

    </div>
  )
}
