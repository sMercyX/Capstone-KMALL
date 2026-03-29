import { useEffect, useState } from "react"
import CategoriesCard from "../../components/Card/CatagoriesCard"
import { useUserStore } from "../../stores/userStore"
import { useProductApi, type Product } from "../../api/productApi"
import { useCatagoriesApi, type CatagoriesResponse } from "../../api/catagoriesApi"
import ProductCardTop5 from "../../components/Card/ProductCardTop5"
import ProductCardTop5Skeleton from "../../components/Card/ProductCardTop5Skeleton"

export default function Dashboard() {
  const { name } = useUserStore()
  const { searchProducts } = useProductApi()
  const { getCatagoriesName } = useCatagoriesApi()
  
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  const [categories, setCategories] = useState<CatagoriesResponse[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

      async function fetchTopProducts() {
      try {
        setLoading(true)
        const res = await searchProducts({
          q: "",
          limit: 5,
          page: 1,
          sortBy: "sold"
        })
        setTopProducts(res.data.items ?? [])
      } catch (err) {
        console.error("Failed to fetch top products", err)
      } finally {
        setLoading(false)
      }
    }

    async function fetchCategories() {
      try {
        setCategoriesLoading(true)
        const res = await getCatagoriesName(0)
        setCategories(res.data ?? [])
      } catch (err) {
        console.error("Failed to fetch categories", err)
      } finally {
        setCategoriesLoading(false)
      }
    }

  useEffect(() => {
    Promise.all([fetchTopProducts(), fetchCategories()])
  }, [])

  return (
    <div className="flex flex-col items-center w-full max-w-7xl mx-auto py-3 px-4 sm:px-6 gap-2">
      {/* Header Section */}
      <div className="flex flex-col items-center text-center">
        <p className="text-description text-black mb-1">
          Hi <span className="text-orange-500 font-bold">{name}!</span> Welcome to
        </p>
        <h1 className="text-header font-black text-gray-900 tracking-tight">
          KMALL - <span className="text-orange-500">KMUTT Marketplace</span>
        </h1>
      </div>

      {/* Categories Row */}
      <div className="w-full">
        <CategoriesCard items={categories} loading={categoriesLoading} />
      </div>

      {/* Top 5 Popular Products Section */}
      <div className="w-full">
        <div className="flex flex-col items-start">
          <h2 className="text-xl font-bold text-[#FF4616] mb-2 uppercase tracking-wide">
            Top 5 Popular Products
          </h2>
          <div className="w-32 h-1 bg-[#FF4616] rounded-full" />
        </div>

        {/* Product Cards Container */}
        <div className="w-full bg-gray-50/50 border border-gray-100 rounded-xl p-6 sm:p-8">

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 lg:gap-6 justify-items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <ProductCardTop5Skeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 lg:gap-6 justify-items-center">
              {topProducts.length > 0 ? (
                topProducts.map((product) => (
                  <ProductCardTop5 key={product.id} product={product} />
                ))
              ) : (
                <div className="col-span-full py-10 text-description text-gray-400">
                  No popular products found at this time.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
