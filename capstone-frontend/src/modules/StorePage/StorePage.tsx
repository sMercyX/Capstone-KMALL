import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import StoreInfoCard from "../../components/Card/StoreInfoCard"
import ProductGrid from "../../components/Product/ProductGrid"
import ProductGridSkeleton from "../../components/Product/ProductGridSkeleton"
import BackButton from "../../components/Buttons/BackButton"
import { useProductApi, type Product } from "../../api/productApi"

// ===== Main Page =====
export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const storeId = Number(id)
  
  const { getProductsStoreByStoreId } = useProductApi()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!storeId) return

    async function fetchProducts() {
      try {
        setIsLoading(true)
        // Fetch products (page 1, limit 100 for now to show all)
        const res = await getProductsStoreByStoreId(storeId, 100, 1)
        setProducts(res.data.items || [])
      } catch (err) {
        console.error("Failed to fetch store products:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [storeId])

  if (!storeId) {
    return (
      <main className="mx-auto max-w-7xl py-12 px-4 text-center">
        <BackButton className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Store Not Found</h1>
        <p className="mt-2 text-gray-500 text-sm">The store you are looking for does not exist or has been removed.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl py-6 md:py-10 px-4 space-y-6">
      <div className="flex justify-start">
        <BackButton />
      </div>

      {/* Store Information Header */}
      <section className="animate-fadeIn">
        <StoreInfoCard storeId={storeId} disableViewButton={true}/>
      </section>
      
      {/* Product List Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            {isLoading ? "Browsing Store..." : `All Products (${products.length})`}
          </h2>
        </div>

        <div className="min-h-[400px]">
          {isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <ProductGrid items={products} />
          )}
        </div>
      </section>
    </main>
  )
}

