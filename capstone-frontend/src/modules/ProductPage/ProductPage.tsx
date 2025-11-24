import { useEffect } from "react"
import {  useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, Star, ShoppingCart, Heart } from "lucide-react"
import { useProductApi } from "../../api/productApi"
import { useProductStore } from "../../stores/productStore"

// ====== UI Helpers ======
function RatingStarsFixed() {
  const full = 4
  const empty = 1

  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} className="h-5 w-5 fill-current" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="h-5 w-5" />
      ))}
    </div>
  )
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const { getProductBySlug } = useProductApi()

  const {
    product,
    isLoading,
    error,
    startLoading,
    setProduct,
    setError,
    reset,
  } = useProductStore()

  // โหลด product เดียว
  useEffect(() => {
    if (!slug) {
      setError("ไม่พบข้อมูลสินค้า")
      return
    }

    let cancelled = false

    async function load() {
      try {
        reset()
        startLoading()

        const res = await getProductBySlug(slug!)
        if (!cancelled) setProduct(res.data)
      } catch (err) {
        if (!cancelled) setError("ไม่สามารถโหลดข้อมูลสินค้าได้")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const handleBack = () => navigate(-1)

  if (isLoading && !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-center text-gray-500 text-sm">กำลังโหลดสินค้า...</p>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <button
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับ
        </button>

        <div className="rounded-xl border bg-white p-8 text-center text-red-500">
          {error || "ไม่พบสินค้า"}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        กลับ
      </button>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* LEFT: Image */}
        <section className="rounded-3xl border bg-white p-4 md:p-6">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-50">
            <img
              src={product.image_url || "https://via.placeholder.com/800"}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        {/* RIGHT: Details */}
        <section className="space-y-4 rounded-3xl border bg-white p-4 md:p-6">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-2 text-gray-700">
            <RatingStarsFixed />
            <span className="text-sm">4.00 | 120 รีวิว</span>
          </div>

          {/* Price */}
          <p className="text-3xl font-bold text-rose-600">
            {product.price ? `${product.price} บาท` : "—"}
          </p>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">
            สินค้านี้เป็นสินค้าที่จำหน่ายบนระบบ KMALL
            สามารถดูรายละเอียดเพิ่มเติมจากร้านค้าต้นทาง
            และเพิ่มลงตะกร้าเพื่อทำการสั่งซื้อได้
          </p>

          {/* Buttons */}
          <div className="pt-2 flex flex-wrap gap-3">
            <button className="flex-1 min-w-[200px] rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition inline-flex items-center justify-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              เพิ่มลงตะกร้า
            </button>

            <button className="h-11 w-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition">
              <Heart className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          {/* Shop name */}
          <p className="pt-3 text-sm text-gray-600">
            ร้าน:{" "}
            <span className="font-semibold">
              {product.store_id || "ร้านค้าทั่วไป"}
            </span>
          </p>
        </section>
      </div>
    </main>
  )
}
