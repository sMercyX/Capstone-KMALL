import { Link } from "react-router-dom"
import { type Product } from "../../api/productApi"
import { resolveImageUrl } from "../../utils/resolve"

interface ProductCardTop5Props {
  product: Product
  index?: number
}

export default function ProductCardTop5({ product }: ProductCardTop5Props) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative flex flex-col w-full max-w-[200px] rounded-lg border border-gray-100 bg-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-orange-500"
    >
      {/* Top Badge */}
      <div className="absolute top-0 right-0 z-10">
        <div className="bg-[#FF4616] text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-lg shadow-sm">
          Top
        </div>
      </div>

      {/* Product Image Area */}
      <div className="relative h-44 w-full bg-gray-50 overflow-hidden">
        <img
          src={resolveImageUrl(product.image_url)}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Units Sold Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-[2px] py-1 px-3">
          <p className="text-white text-[10px] text-description font-medium text-center truncate">
            {product.sold_count || 0} units sold
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-3 flex flex-col gap-0.5">
        <h3 className="text-text font-semibold text-gray-900 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-description text-gray-400 line-clamp-1 mb-2">
          {product.store_name || "ไม่มีชื่อร้าน"}
        </p>
        <p className="text-xl font-semibold text-[#FF4616] mt-auto">
          ฿{product.price.toLocaleString()}
        </p>
      </div>
    </Link>
  )
}
