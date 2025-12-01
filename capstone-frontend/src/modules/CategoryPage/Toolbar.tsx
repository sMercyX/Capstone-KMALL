import { Filter, Check, ArrowUpDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export type SortKey = "ASC" | "DESC"
export type FilterKey = string

interface ToolbarProps {
  sort: SortKey
  onChangeSort: (s: SortKey) => void
  filter?: FilterKey[]
  onChangeFilter?: (f: FilterKey[]) => void
}

function Dropdown({
  label,
  icon: Icon,
  value, // string | string[]
  options,
  onChange,
  multiple = false,
}: {
  label: string
  icon: any
  value: string | string[]
  options: { label: string; value: string }[]
  onChange: (val: string) => void
  multiple?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className="inline-flex items-center gap-2 rounded-xl bg-[#f5f5f5] px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-base">{label}</span>
        {Array.isArray(value) && value.length > 0 && (
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">
            {value.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-xl bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/5 z-50">
          <div className="space-y-1">
            {options.map((opt) => {
              const isSelected = Array.isArray(value)
                ? value.includes(opt.value)
                : value === opt.value

              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    if (!multiple) setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                    ${isSelected ? "text-orange-600 bg-orange-50" : "text-gray-600 hover:bg-gray-50"}
                  `}
                >
                  <span className={isSelected ? "font-medium" : ""}>
                    {opt.label}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-orange-500" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Toolbar({
  sort,
  onChangeSort,
  filter = [],
  onChangeFilter,
  filterOptions = [],
}: ToolbarProps & { filterOptions?: { label: string; value: string }[] }) {

  const sortOptions = [
    { label: "ราคาต่ำสุด", value: "ASC" },
    { label: "ราคาสูงสุด", value: "DESC" },
  ]

  const handleFilterChange = (val: string) => {
    if (!onChangeFilter) return
    const newFilter = [...filter]
    const index = newFilter.indexOf(val as FilterKey)
    if (index > -1) {
      newFilter.splice(index, 1)
    } else {
      newFilter.push(val as FilterKey)
    }
    onChangeFilter(newFilter)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Filter (Multi-select) */}
      <Dropdown
        label="Filter"
        icon={Filter}
        value={filter}
        options={filterOptions}
        onChange={handleFilterChange}
        multiple={true}
      />

      {/* Right: Sort (Single-select) */}
      <Dropdown
        label="Sort by"
        icon={ArrowUpDown}
        value={sort}
        options={sortOptions}
        onChange={(val) => onChangeSort(val as SortKey)}
      />
    </div>
  )
}
