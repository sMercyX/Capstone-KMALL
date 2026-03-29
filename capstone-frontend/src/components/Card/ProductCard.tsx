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
      className="group block overflow-hidden rounded-lg bg-white shadow-md transition-shadow duration-300 cursor-pointer hover:shadow-lg hover:scale-105 transition duration-300"
    >
      {/* Image - fixed 200px height */}
      <div className="relative h-[200px] overflow-hidden rounded-lg rounded-b-none">
        <img
          src={resolveImageUrl(product.image_url)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {/* Hover Overlay - gray tint */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="px-2 py-3">
        {/* Product Name */}
        <h3 className="text-text font-medium text-gray-900 line-clamp-1 mb-0.5">
          {product.name}
        </h3>

        {/* Store Name / Description */}
        <p className="text-description text-gray-400 line-clamp-1 mb-3">
          {product.store_name || "ไม่มีชื่อร้าน"}
        </p>


        {/* Price & Sold Count */}
        <div className="flex items-end justify-between">
          <p className="text-text font-bold text-orange-500">
            ฿{product.price ? product.price.toLocaleString() : "—"}
          </p>
          <p className="text-description text-gray-400">
            Sold {product.sold_count || 0} pieces
          </p>
        </div>
      </div>
    </Link>
  )
}
