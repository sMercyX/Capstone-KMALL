import { useEffect, useState } from "react"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { useProductApi } from "../../api/productApi"
import { useCatagoriesApi } from "../../api/catagoriesApi"
import { useProductListStore } from "../../stores/catagoriesStore"
import PageHeader from "./PageHeader"
import FilterSidebar from "./FilterSidebar"
import SortBar, { type SortKey } from "./SortBar"
import ProductGrid from "../../components/Product/ProductGrid"
import Pagination from "../../components/Pagination/Pagination"

// ====================== MAIN PAGE ======================
export default function CategoryPage() {
  const { category: routeCategory } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const q = searchParams.get("q") || ""
  const parentIdParam = searchParams.get("parent_id")

  const [apiCategoryId, setApiCategoryId] = useState<number>(0)
  const [categoryTitle, setCategoryTitle] = useState<string>("")
  const [isResolving, setIsResolving] = useState(true)

  const [sort, setSort] = useState<SortKey>("latest")
  // filter is now number[] (category IDs)
  const [filter, setFilter] = useState<number[]>([]) 
  const [filterOptions, setFilterOptions] = useState<{ label: string; value: string }[]>([])
  
  // Price range from API response
  const [apiMinPrice, setApiMinPrice] = useState<number>(0)
  const [apiMaxPrice, setApiMaxPrice] = useState<number>(500)
  // User selected price range for filtering
  const [selectedMinPrice, setSelectedMinPrice] = useState<number | undefined>(undefined)
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | undefined>(undefined)

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

  const { getProductsByParentId, searchProducts } = useProductApi()
  const { getCatagoriesName } = useCatagoriesApi()

  // 1. Resolve Category ID and Title
  useEffect(() => {
    async function resolveCategory() {
      try {
        setIsResolving(true)
        
        // Priority 1: parent_id query param
        const target = parentIdParam || routeCategory || "food"
        
        const isNumeric = /^\d+$/.test(target)
        const res = await getCatagoriesName(0) // Get all main categories
        
        const foundCat = res.data?.find(c => 
          isNumeric ? c.id === parseInt(target) : c.slug === target
        )

        if (foundCat) {
          setApiCategoryId(foundCat.id)
          setCategoryTitle(foundCat.name)
          
          // PRETTY URL: If they used numeric ID or query param, redirect to clean slug-based path
          if ((isNumeric || parentIdParam) && foundCat.slug) {
            navigate(`/categories/${foundCat.slug}${location.search ? '?' + location.search : ''}`, { replace: true })
          }
          setError(null)
        } else {
          setError("Category not found.")
        }
      } catch (err) {
        console.error("Failed to resolve category:", err)
        setError("Unable to load category information.")
      } finally {
        setIsResolving(false)
      }
    }
    resolveCategory()
  }, [parentIdParam, routeCategory, navigate, location.search])

  // reset เมื่อเปลี่ยนหมวด
  useEffect(() => {
    reset()
    setPageIndex(1)
    setFilter([])
    setSelectedMinPrice(undefined)
    setSelectedMaxPrice(undefined)
  }, [apiCategoryId, reset, setPageIndex])

  // Fetch filter options (Sub-categories)
  useEffect(() => {
    if (!apiCategoryId) return
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
    if (isResolving || !apiCategoryId) return
    let ignore = false

    async function fetchData() {
      try {
        startLoading()
        // filter is already number[]
        const categoryIds = filter
        
        let res
        if (q) {
          // ถ้ามีคำค้นหา ใช้ searchProducts (Global Search)
          res = await searchProducts({
            q,
            limit: pageSize,
            page: pageIndex,
            sortBy: sort,
          })
        } else {
          // ถ้าไม่มี ใช้ตามเดิม
          res = await getProductsByParentId(apiCategoryId, pageSize, pageIndex, sort, categoryIds, selectedMinPrice, selectedMaxPrice)
        }
        
        if (ignore) return
        setPageData(res.data)
        
        // Store minPrice/maxPrice from API response
        if (res.data.minPrice !== undefined && selectedMinPrice === undefined) {
          setApiMinPrice(res.data.minPrice)
        }
        if (res.data.maxPrice !== undefined && selectedMaxPrice === undefined) {
          setApiMaxPrice(res.data.maxPrice)
        }
        setError(null)
      } catch (err) {
        if (ignore) return
        setError("Unable to load products.")
      }
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [
    apiCategoryId,
    isResolving,
    pageIndex,
    pageSize,
    sort,
    filter,
    q,
    selectedMinPrice,
    selectedMaxPrice
  ])

  // Handle price range change from FilterSidebar
  const handlePriceRangeChange = (min: number, max: number) => {
    setSelectedMinPrice(min)
    setSelectedMaxPrice(max)
    setPageIndex(1)
    setSort("latest")
  }

  // Handle category change from FilterSidebar
  const handleCategoryChange = (ids: number[]) => {
    setFilter(ids)
    setPageIndex(1)
    setSort("latest")
  }

  const safeTotal = typeof total === "number" ? total : 0
  const safeSize = typeof pageSize === "number" ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize))

  if (isResolving) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl py-8 md:py-12">
      <PageHeader category={categoryTitle} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        
        {/* SIDEBAR */}
        <aside className="hidden lg:block">
            <div className="sticky top-24">
                <FilterSidebar 
                    filterOptions={filterOptions}
                    selectedCategories={filter}
                    onChangeCategory={handleCategoryChange}
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
            onChangeSort={setSort}
            onPageChange={setPageIndex}
          />

          <div className="mt-6">
            {isLoading ? (
              <div className="py-20 text-center">
                 <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                 </div>
                 <p className="mt-2 text-gray-500">Loading products...</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                {error}
              </div>
            ) : items.length === 0 ? (
                <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No products found in this category.
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

