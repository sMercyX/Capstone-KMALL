import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useProductApi } from "../../api/productApi"
import { useCatagoriesApi } from "../../api/catagoriesApi"
import { useProductListStore } from "../../stores/catagoriesStore"
import SearchPageHeader from "./SearchPageHeader"
import FilterSidebar from "../CategoryPage/FilterSidebar"
import SortBar, { type SortKey } from "../CategoryPage/SortBar"
import ProductGrid from "../../components/Product/ProductGrid"
import Pagination from "../../components/Pagination/Pagination"

export default function SearchPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const q = searchParams.get("q") || ""
  const sortFromUrl = (searchParams.get("sort_by") as SortKey) || "latest"

  const [sort, setSort] = useState<SortKey>(sortFromUrl)
  const [filter, setFilter] = useState<number[]>([]) 
  const [filterOptions, setFilterOptions] = useState<{ label: string; value: string }[]>([])
  
  // Price range from API response
  const [apiMinPrice, setApiMinPrice] = useState<number>(0)
  const [apiMaxPrice, setApiMaxPrice] = useState<number>(500)
  // User selected price range for filtering
  const [selectedMinPrice, setSelectedMinPrice] = useState<number | undefined>(undefined)
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | undefined>(undefined)

  // Handle sort change and update URL
  const handleSortChange = (newSort: SortKey) => {
    setSort(newSort)
    const params = new URLSearchParams(location.search)
    params.set("sort_by", newSort)
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

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
  const { getCatagoriesName } = useCatagoriesApi()

  // Reset when query changes
  useEffect(() => {
    reset()
    setPageIndex(1)
    setFilter([])
    setSelectedMinPrice(undefined)
    setSelectedMaxPrice(undefined)
  }, [q, reset, setPageIndex])

  // Fetch all categories for filter (parent_id = 1 for food categories as default)
  useEffect(() => {
    async function fetchCategories() {
      try {
        // Fetch categories from all parent categories (1, 2, 3)
        const [res1, res2, res3] = await Promise.all([
          getCatagoriesName(1),
          getCatagoriesName(2),
          getCatagoriesName(3),
        ])
        const allCategories = [
          ...(res1.data || []),
          ...(res2.data || []),
          ...(res3.data || []),
        ]
        const options = allCategories.map((cat) => ({
          label: cat.name,
          value: String(cat.id),
        }))
        setFilterOptions(options)
      } catch (err) {
        console.error("Failed to fetch categories:", err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch search results
  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        startLoading()
        const res = await searchProducts({
          q,
          limit: pageSize,
          page: pageIndex,
          sortBy: sort,
          categoryIds: filter.length > 0 ? filter : undefined,
          minPrice: selectedMinPrice,
          maxPrice: selectedMaxPrice,
        })
        if (ignore) return
        setPageData(res.data)
        
        // Store minPrice/maxPrice from API response (only on first load or when no filter applied)
        if (res.data.minPrice !== undefined && selectedMinPrice === undefined) {
          setApiMinPrice(res.data.minPrice)
        }
        if (res.data.maxPrice !== undefined && selectedMaxPrice === undefined) {
          setApiMaxPrice(res.data.maxPrice)
        }
        
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
  }, [q, pageIndex, pageSize, sort, filter, selectedMinPrice, selectedMaxPrice])

  // Handle price range change from FilterSidebar
  const handlePriceRangeChange = (min: number, max: number) => {
    setSelectedMinPrice(min)
    setSelectedMaxPrice(max)
    setPageIndex(1)
  }

  const safeTotal = typeof total === "number" ? total : 0
  const safeSize = typeof pageSize === "number" ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))

  return (
    <main className="mx-auto max-w-7xl py-8 md:py-12">
      <SearchPageHeader query={q} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        
        {/* SIDEBAR */}
        <aside className="hidden lg:block">
            <div className="sticky top-24">
                <FilterSidebar 
                    filterOptions={filterOptions}
                    selectedCategories={filter}
                    onChangeCategory={setFilter}
                    priceMin={apiMinPrice}
                    priceMax={apiMaxPrice}
                    onChangePriceRange={handlePriceRangeChange}
                    maxPriceLimit={apiMaxPrice}
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
            onChangeSort={handleSortChange}
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
