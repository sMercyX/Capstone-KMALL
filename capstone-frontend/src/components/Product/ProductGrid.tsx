import { type Product } from "../../api/productApi"
import ProductCard from "./ProductCard"

interface ProductGridProps {
  items: Product[]
}

export default function ProductGrid({ items }: ProductGridProps) {
  const safeItems = Array.isArray(items) ? items : []

  if (!safeItems.length)
    return (
      <div className="py-10 text-center text-gray-500">
        ยังไม่มีสินค้าในหมวดนี้
      </div>
    )

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {safeItems.map((item) => (
        <ProductCard key={item.id} product={item} />
      ))}
    </div>
  )
}
