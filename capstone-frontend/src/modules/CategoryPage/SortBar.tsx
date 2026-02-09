import { ArrowUpDown, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export type SortKey = "latest" | "sold" | "price_asc" | "price_desc"

interface SortBarProps {
  totalItems: number
  pageIndex: number
  pageSize: number
  sort: SortKey
  onChangeSort: (s: SortKey) => void
  onPageChange?: (page: number) => void
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (val: SortKey) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options: { label: string; value: SortKey }[] = [
    { label: "ล่าสุด", value: "latest" },
    { label: "ขายดี", value: "sold" },
    { label: "ราคาต่ำ-สูง", value: "price_asc" },
    { label: "ราคาสูง-ต่ำ", value: "price_desc" },
  ]

  const currentLabel = options.find((o) => o.value === value)?.label

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span className="text-gray-500">เรียงโดย:</span>
        <span className="font-medium text-orange-600">{currentLabel}</span>
        <ArrowUpDown className="h-3 w-3 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-white p-1 shadow-lg z-20">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm
                ${value === opt.value ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"}
              `}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SortBar({
  totalItems,
  pageIndex,
  pageSize,
  sort,
  onChangeSort,
  onPageChange,
}: SortBarProps) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-gray-50 p-3">
      <div className="text-sm text-gray-500">
        Showing all <span className="font-medium text-gray-900">{totalItems}</span> results
      </div>

      <div className="flex items-center gap-3">
        <SortDropdown value={sort} onChange={onChangeSort} />

        {/* Small Pagination Controls (Optional, matching screenshot style) */}
        {onPageChange && (
          <div className="flex items-center rounded-lg border bg-white p-1">
            <span className="px-2 text-xs font-medium text-gray-600">
              {pageIndex}/{totalPages}
            </span>
            <div className="h-4 w-[1px] bg-gray-200 mx-1" />
            <button
              onClick={() => onPageChange(Math.max(1, pageIndex - 1))}
              disabled={pageIndex <= 1}
              className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, pageIndex + 1))}
              disabled={pageIndex >= totalPages}
              className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
