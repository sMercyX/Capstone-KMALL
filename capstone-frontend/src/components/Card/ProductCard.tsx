import { Link } from "react-router-dom"
import { Star } from "lucide-react"
import { type Product } from "../../api/productApi"
import { resolveImageUrl } from "../../utils/resolve"

interface ProductCardProps {
  product: Product
}

// Rating stars component
function RatingStars({ rating = 3, reviewCount = 0 }: { rating?: number; reviewCount?: number }) {
  const fullStars = Math.floor(rating)
  const emptyStars = 5 - fullStars
  
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 fill-orange-400 text-orange-400" />
        ))}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
        ))}
      </div>
      <span className="text-xs text-gray-500">({reviewCount})</span>
    </div>
  )
}

export default function ProductCard({ product }: ProductCardProps) {
  // Mock rating for demo (you can replace with real data when available)
  const mockRating = Math.floor(Math.random() * 2) + 3 // 3-4 stars
  const mockReviewCount = Math.floor(Math.random() * 400) + 50

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
      <div className="px-1 py-3 space-y-1">
        {/* Rating */}
        <RatingStars rating={mockRating} reviewCount={mockReviewCount} />

        {/* Product Name */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
          {product.name}
        </h3>

        {/* Store Name */}
        <p className="text-xs text-gray-500 line-clamp-1">
          {product.store_name || "Shop"}
        </p>

        {/* Price */}
        <p className="text-base font-bold text-orange-500">
          {product.price ? `฿${product.price}` : "—"}
        </p>
      </div>
    </Link>
  )
}
