import { Link } from "react-router-dom"
import { type Product } from "../../api/productApi"
import { resolveImageUrl } from "../../utils/resolve"
// import RatingStars from "../Rating/RatingStars"

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-xl transition"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={resolveImageUrl(product.image_url)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />

        <div className="absolute inset-0 bg-black/40 opacity-0 transition duration-300 group-hover:opacity-100" />
      </div>

      <div className="px-3 pb-3 pt-2 space-y-2">
        {/* <div className="flex items-center gap-2">
          <RatingStars rating={4} />
          <span className="text-xs text-gray-500">(120)</span>
        </div> */}

        <h3 className="text-sm font-semibold line-clamp-1">{product.name}</h3>

        {/* BE ยังไม่มีชื่อร้าน ใช้ข้อความ fix */}
        <p className="text-xs text-gray-500 line-clamp-1">{product.store_name}</p>

        <p className="pt-1 font-semibold text-rose-600">
          {product.price ? `${product.price} บาท` : "—"}
        </p>
      </div>
    </Link>
  )
}
