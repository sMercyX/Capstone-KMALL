import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useProductApi } from "../../api/productApi"
import { useProductListStore } from "../../stores/catagoriesStore"
import SearchPageHeader from "./SearchPageHeader"
import SortBar, { type SortKey } from "../CategoryPage/SortBar"
import ProductGrid from "../../components/Product/ProductGrid"
import Pagination from "../../components/Pagination/Pagination"

export default function SearchPage() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const q = searchParams.get("q") || ""

  const [sort, setSort] = useState<SortKey>("ASC")

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

  const { searchProducts } = useProductApi()

  // Reset when query changes
  useEffect(() => {
    reset()
    setPageIndex(1)
  }, [q, reset, setPageIndex])

  // Fetch search results
  useEffect(() => {
    if (!q.trim()) return

    let ignore = false

    async function fetchData() {
      try {
        startLoading()
        const res = await searchProducts(q, pageSize, pageIndex, sort)
        if (ignore) return
        setPageData(res.data)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError("โหลดผลการค้นหาล้มเหลว")
      }
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [q, pageIndex, pageSize, sort])

  const safeTotal = typeof total === "number" ? total : 0
  const safeSize = typeof pageSize === "number" ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))

  // If no query, show empty state
  if (!q.trim()) {
    return (
      <main className="mx-auto max-w-7xl py-8 md:py-12">
        <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          กรุณาใส่คำค้นหา
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl py-8 md:py-12">
      <SearchPageHeader query={q} />

      <div className="mt-10">
        {/* MAIN CONTENT */}
        <div className="min-w-0">
          
          <SortBar 
            totalItems={safeTotal}
            pageIndex={pageIndex}
            pageSize={pageSize}
            sort={sort}
            onChangeSort={setSort}
            onPageChange={setPageIndex}
          />

          <div className="mt-6">
            {isLoading ? (
              <div className="py-20 text-center">
                 <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                 </div>
                 <p className="mt-2 text-gray-500">กำลังค้นหา...</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                {error}
              </div>
            ) : items.length === 0 ? (
                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    ไม่พบสินค้าที่ตรงกับ "{q}"
                </div>
            ) : (
              <ProductGrid items={items} />
            )}
          </div>

          {/* Bottom Pagination (Full) */}
          {items.length > 0 && (
            <div className="mt-10">
                <Pagination
                currentPage={pageIndex}
                totalPages={totalPages}
                onPageChange={setPageIndex}
                />
            </div>
          )}
        </div>
      
      </div>
    </main>
  )
}
