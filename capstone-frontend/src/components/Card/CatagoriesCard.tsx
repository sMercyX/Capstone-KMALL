// src/components/Card/CategoriesCard.tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Utensils, Shirt, Package } from "lucide-react"
import { useCatagoriesApi, type CatagoriesResponse } from "../../api/catagoriesApi"


// map slug -> Icon Component
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  food: Utensils,
  clothing: Shirt,
  "handmade-products": Package ,
}

// map name อังกฤษ -> ไทย (จะใช้/ไม่ใช้ก็ได้)
const CATEGORY_NAME_MAP: Record<string, string> = {
  Food: "Food",
  Clothing: "Clothing",
  "Handmade Products": "Handmade Products",
}

function SingleCategoryCard({ item }: { item: CatagoriesResponse }) {
  const Icon = CATEGORY_ICON_MAP[item.slug] ?? Package
  const displayName = CATEGORY_NAME_MAP[item.name] ?? item.name

  return (
    <Link
      to={`/categories/${item.slug}`}
      className="group w-full max-w-[240px] rounded-3xl border border-orange-200 bg-white shadow-[0_8px_20px_rgba(255,102,0,0.15)] px-8 py-6 text-center hover:-translate-y-1 transition duration-300"
    >
      <div className="mx-auto h-24 w-24 rounded-full bg-orange-50 grid place-items-center overflow-hidden mb-4">
        <Icon className="h-12 w-12 text-orange-500" />
      </div>
      <div className="font-semibold text-lg text-gray-800">{displayName}</div>
    </Link>
  )
}

export default function CategoriesCard() {
  const { getCatagoriesName } = useCatagoriesApi()
  const [items, setItems] = useState<CatagoriesResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchCategories() {
      try {
        setLoading(true)
        setError(null)

        const res = await getCatagoriesName(0) // ดึง parent_id = 0
        if (!isMounted) return

        // สมมติ ApiResponse มี field data
        setItems(res.data ?? [])
      } catch {
        if (!isMounted) return
        setError("Unable to load categories.")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCategories()

    // 🔥 สำคัญ: [] ทำให้เรียกครั้งเดียว ไม่ยิง loop
    return () => {
      isMounted = false
    }
  }, []) // <= ห้ามใส่ getCatagoriesName ใน dependency

  if (loading) {
    return (
      <div className="mt-5 flex flex-wrap items-stretch justify-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="w-full max-w-[240px] rounded-3xl border border-orange-100 bg-white px-8 py-6"
          >
            <div className="mx-auto h-24 w-24 rounded-full bg-orange-50 animate-pulse mb-4" />
            <div className="h-6 w-32 mx-auto rounded-full bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-5 text-center text-sm text-red-500">{error}</div>
    )
  }

  if (!items.length) {
    return (
      <div className="mt-5 text-center text-sm text-gray-500">
        No categories are currently available.
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-wrap items-stretch justify-center gap-4">
      {items.map((c) => (
        <SingleCategoryCard key={c.id} item={c} />
      ))}
    </div>
  )
}
