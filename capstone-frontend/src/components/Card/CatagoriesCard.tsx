// src/components/Card/CatagoriesCard.tsx
import { useEffect, useState, useRef } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Utensils, Shirt, Package, Monitor, ShoppingBag } from "lucide-react"
import { useCatagoriesApi, type CatagoriesResponse } from "../../api/catagoriesApi"
import { resolveImageUrl } from "../../utils/resolve"

// map slug -> Icon Component matching screenshot vibes
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  food: Utensils,
  clothing: Shirt,
  "handmade-products": Package,
  electronics: Monitor,
  beauty: ShoppingBag,
}

const CATEGORY_NAME_MAP: Record<string, string> = {
  Food: "Food",
  Clothing: "Clothing",
  "Handmade Products": "Handmade Products",
}

function SingleCategoryCard({ item }: { item: CatagoriesResponse; isActive?: boolean }) {
  const Icon = CATEGORY_ICON_MAP[item.slug] ?? Package
  const displayName = CATEGORY_NAME_MAP[item.name] ?? item.name

  return (
    <Link
      to={`/categories/${item.slug}`}
      className={`flex flex-col items-center justify-center min-w-[140px] h-[140px] sm:min-w-[160px] sm:h-[160px] rounded-lg border bg-white transition-all duration-300 hover:shadow-lg border-gray-100 hover:border-orange-500 hover:scale-105 my-2`}
    >
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-orange-50 grid place-items-center overflow-hidden mb-3">
        {item.icon_url ? (
            <img
            src={resolveImageUrl(item.icon_url)}
            alt={displayName}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
        ) : (
            <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-[#FF4616]" />
        )}
      </div>
      <div className="text-text font-bold text-gray-800 text-center px-2 line-clamp-1 tracking-wide break-all">
        {displayName}
      </div>
    </Link>
  )
}

export default function CategoriesCard({ activeSlug }: { activeSlug?: string }) {
  const { getCatagoriesName } = useCatagoriesApi()
  const [items, setItems] = useState<CatagoriesResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5) // 5px buffer
    }
  }

  useEffect(() => {
    let isMounted = true
    async function fetchCategories() {
      try {
        setLoading(true)
        const res = await getCatagoriesName(0)
        if (!isMounted) return
        setItems(res.data ?? [])
        // Initial check after render
        setTimeout(checkScroll, 100)
      } catch {
        if (!isMounted) return
        setError("Unable to load categories.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchCategories()
    return () => { isMounted = false }
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkScroll, 350) // Wait for animation
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex gap-4 overflow-hidden w-full px-4 items-center justify-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-w-[160px] h-[160px] rounded-lg border border-gray-100 bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || !items.length) {
    return <div className="mt-8 text-center text-description text-gray-400">No categories available.</div>
  }

  return (
    <div className="relative group">
      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 px-4 overflow-x-auto no-scrollbar scroll-smooth w-full"
      >
        {items.map((c) => (
          <SingleCategoryCard key={c.id} item={c} isActive={c.is_active === "YES" || c.slug === activeSlug} />
        ))}
      </div>

      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full border border-gray-100 shadow-md hover:bg-gray-50 transition z-10 hidden sm:flex"
        >
          <ChevronRight className="h-5 w-5 text-[#FF4616] rotate-180" />
        </button>
      )}

      {showRightArrow && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full border border-gray-100 shadow-md hover:bg-gray-50 transition z-10 hidden sm:flex"
        >
          <ChevronRight className="h-5 w-5 text-[#FF4616]" />
        </button>
      )}
    </div>
  )
}
