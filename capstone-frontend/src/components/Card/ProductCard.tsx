import { Link } from "react-router-dom"
import { type Product } from "../../api/productApi"
import { resolveImageUrl } from "../../utils/resolve"

interface ProductCardProps {
  product: Product
}



export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group block overflow-hidden rounded-xl bg-white"
    >
      {/* Image - approximately 212x160 for aspect ratio matching the design */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
        <img
          src={resolveImageUrl(product.image_url)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="px-1 py-3">
        {/* Product Name */}
        <h3 className="text-base font-medium text-gray-900 line-clamp-1 mb-0.5">
          {product.name}
        </h3>

        {/* Store Name / Description */}
        <p className="text-sm text-gray-500 line-clamp-1 mb-3">
          {product.store_name || "ไม่มีชื่อร้าน"}
        </p>

        {/* Price & Sold Count */}
        <div className="flex items-end justify-between">
          <p className="text-xl font-bold text-orange-500">
            ฿{product.price ? product.price.toLocaleString() : "—"}
          </p>
          <p className="text-sm text-gray-500">
            ขายได้ {product.sold_count || 0} ชิ้น
          </p>
        </div>
      </div>
    </Link>
  )
}
