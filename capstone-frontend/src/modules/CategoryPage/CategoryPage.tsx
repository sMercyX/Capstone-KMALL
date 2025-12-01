import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useProductApi } from "../../api/productApi"
import { useProductListStore } from "../../stores/catagoriesStore"
import PageHeader from "./Category/PageHeader"
import Toolbar, { type SortKey } from "./Category/Toolbar"
import ProductGrid from "../../components/Product/ProductGrid"
import Pagination from "../../components/Pagination/Pagination"

// ====================== UTIL MAPPING ======================
function mapCategoryId(category?: string) {
  switch (category) {
    case "food":
      return 1
    case "clothe":
    case "clothes":
    case "clothing":
      return 2
    case "handmade":
    case "handmade-products":
      return 3
    default:
      return 1
  }
}

// ====================== MAIN PAGE ======================
export default function CategoryPage() {
  const { category: routeCategory } = useParams()

  const apiCategoryId = mapCategoryId(routeCategory)

  const [sort, setSort] = useState<SortKey>("popular")

  const {
    items,
    pageIndex,
    pageSize,
    total,
    isLoading,
    error,
    setPageIndex,
    startLoading,
    setPageData,
    setError,
    reset,
  } = useProductListStore()

  // ใช้ getProductsByParentId แล้ว
  const { getProductsByParentId } = useProductApi()

  // reset เมื่อเปลี่ยนหมวด
  useEffect(() => {
    reset()
    setPageIndex(1)
  }, [routeCategory, reset, setPageIndex])

  // ดึงข้อมูลอัตโนมัติเมื่อเข้าเพจ / เปลี่ยนหน้า / เปลี่ยนหมวด
  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        startLoading()
        const res = await getProductsByParentId(apiCategoryId, pageSize, pageIndex)
        if (ignore) return
        setPageData(res.data)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError("โหลดสินค้าล้มเหลว")
      }
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [
    apiCategoryId,
    pageIndex,
    pageSize,
  ])

  // sort ฝั่ง FE
  const sortedItems = useMemo(() => {
    const copy = Array.isArray(items) ? [...items] : []

    switch (sort) {
      case "price-asc":
        return copy.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
      case "price-desc":
        return copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      case "rating":
        // ตอนนี้ rating fix ไว้ ยังไม่มี field จาก BE
        return copy
      default:
        return copy
    }
  }, [items, sort])

  const safeTotal = typeof total === "number" ? total : 0
  const safeSize = typeof pageSize === "number" ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <PageHeader category={routeCategory || "food"} />

      <div className="mt-6">
        <Toolbar
          total={safeTotal || sortedItems.length}
          sort={sort}
          onChangeSort={setSort}
        />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">
            กำลังโหลดสินค้า...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-500">{error}</div>
        ) : (
          <ProductGrid items={sortedItems} />
        )}
      </div>

      {/* แสดง pagination เฉพาะตอนมีของ */}
      {sortedItems.length > 0 && (
        <Pagination
          currentPage={pageIndex}
          totalPages={totalPages}
          onPageChange={setPageIndex}
        />
      )}
    </main>
  )
}

