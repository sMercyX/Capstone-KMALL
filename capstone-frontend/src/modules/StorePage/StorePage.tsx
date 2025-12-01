import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import Card from "../../components/Card/Card"
import StoreInfoCard from "../../components/Card/StoreInfoCard"
import ProductCard from "../../components/Card/ProductCard"
import { useProductApi, type Product } from "../../api/productApi"

// ===== Sub-components =====
// function StoreTabs() {
//   return (
//     <div className="mt-6 flex items-center justify-between gap-4">
//       <div className="flex gap-2 text-xs md:text-sm">
//         <button className="rounded-full bg-orange-500 px-3 md:px-4 py-1.5 font-semibold text-white shadow-sm">
//           สินค้าทั้งหมด
//         </button>
//         <button className="rounded-full px-3 md:px-4 py-1.5 text-gray-600 hover:bg-gray-100">
//           โปรโมชั่น
//         </button>
//         <button className="rounded-full px-3 md:px-4 py-1.5 text-gray-600 hover:bg-gray-100">
//           สินค้าแนะนำ
//         </button>
//       </div>

//       <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
//         <span className="text-gray-600">จัดเรียง:</span>
//         <select className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700">
//           <option>ขายดี</option>
//           <option>ราคาต่ำ → สูง</option>
//           <option>ราคาสูง → ต่ำ</option>
//           <option>คะแนนสูงสุด</option>
//         </select>
//       </div>
//     </div>
//   )
// }

function StoreProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return <div className="mt-10 text-center text-gray-500">ยังไม่มีสินค้าในร้านนี้</div>
  }

  return (
    <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

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
        // Fetch products (page 1, limit 100 for now)
        const res = await getProductsStoreByStoreId(storeId, 100, 1)
        
        setProducts(res.data.items)
      } catch (err) {
        console.error("Failed to fetch store products:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [storeId])

  if (!storeId) {
    return <div className="text-center py-10">ไม่พบร้านค้า</div>
  }

  return (
    <Card className="max-w-6xl mx-auto ">
      <StoreInfoCard storeId={storeId} />
      
      <div className="px-6">
        
        {isLoading ? (
           <div className="mt-10 text-center text-gray-500">กำลังโหลดสินค้า...</div>
        ) : (
           <StoreProductGrid products={products} />
        )}
      </div>
    </Card>
  )
}

