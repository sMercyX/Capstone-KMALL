import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useProductApi } from "../../api/productApi"
import { useCatagoriesApi } from "../../api/catagoriesApi"
import { useProductListStore } from "../../stores/catagoriesStore"
import PageHeader from "./PageHeader"
import FilterSidebar from "./FilterSidebar"
import SortBar, { type SortKey } from "./SortBar"
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

  const [sort, setSort] = useState<SortKey>("ASC")
  // filter is now number[] (category IDs)
  const [filter, setFilter] = useState<number[]>([]) 
  const [filterOptions, setFilterOptions] = useState<{ label: string; value: string }[]>([])

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
  const { getCatagoriesName } = useCatagoriesApi()

  // reset เมื่อเปลี่ยนหมวด
  useEffect(() => {
    reset()
    setPageIndex(1)
    setFilter([])
  }, [routeCategory, reset, setPageIndex])

  // Fetch filter options (Sub-categories)
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await getCatagoriesName(apiCategoryId)
        if (res.data) {
          const options = res.data.map((cat) => ({
            label: cat.name,
            value: String(cat.id),
          }))
          setFilterOptions(options)
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err)
      }
    }
    fetchCategories()
  }, [apiCategoryId])

  // ดึงข้อมูลอัตโนมัติเมื่อเข้าเพจ / เปลี่ยนหน้า / เปลี่ยนหมวด / เปลี่ยน sort / เปลี่ยน filter
  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        startLoading()
        // filter is already number[]
        const categoryIds = filter
        const res = await getProductsByParentId(apiCategoryId, pageSize, pageIndex, sort, categoryIds)
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
    sort,
    filter
  ])

  const safeTotal = typeof total === "number" ? total : 0
  const safeSize = typeof pageSize === "number" ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))

  return (
    <main className="mx-auto max-w-7xl py-8 md:py-12">
      <PageHeader category={routeCategory || "food"} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        
        {/* SIDEBAR */}
        <aside className="hidden lg:block">
            <div className="sticky top-24">
                <FilterSidebar 
                    filterOptions={filterOptions}
                    selectedCategories={filter}
                    onChangeCategory={setFilter}
                />
            </div>
        </aside>

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
                 <p className="mt-2 text-gray-500">กำลังโหลดสินค้า...</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                {error}
              </div>
            ) : items.length === 0 ? (
                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    ไม่พบสินค้าในหมวดหมู่นี้
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

