import { Filter, ChevronDown } from "lucide-react"

export type SortKey = "popular" | "price-asc" | "price-desc" | "rating"

interface ToolbarProps {
  total: number
  sort: SortKey
  onChangeSort: (s: SortKey) => void
}

export default function Toolbar({
  total,
  sort,
  onChangeSort,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-600">Showing all {total} results</p>

      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
          <Filter className="h-4 w-4" /> Filter
        </button>

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onChangeSort(e.target.value as SortKey)}
            className="appearance-none rounded-xl border bg-white px-3 py-2 pr-8 text-sm hover:bg-gray-50"
          >
            <option value="popular">Sort by: Popular</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Rating</option>
          </select>

          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </div>
    </div>
  )
}
