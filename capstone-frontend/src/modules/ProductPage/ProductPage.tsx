// src/pages/product/ProductPage.tsx
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ShoppingCart,
  Heart,
} from "lucide-react"
import { useProductApi } from "../../api/productApi"
import { useProductStore } from "../../stores/productStore"
import { useCartStore } from "../../stores/cartStore"
import Card from "../../components/Card/Card"
import { useCartApi } from "../../api/cartApi"
import { resolveImageUrl } from "../../utils/resolve"

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
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { getProduct } = useProductApi()
  const {
    product,
    isLoading,
    error,
    startLoading,
    setProduct,
    setError,
    reset,
  } = useProductStore()

  const { addCart, getCart } = useCartApi()
  const {
    startLoading: startCartLoading,
    setCart,
    setError: setCartError,
  } = useCartStore()

  const [qty, setQty] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // โหลด product เดียว
  useEffect(() => {
    if (!id) {
      setError("ไม่พบสินค้า")
      return
    }

    let cancelled = false

    async function load() {
      try {
        reset()
        startLoading()

        const productId = Number(id)
        const res = await getProduct(productId)

        if (!cancelled) {
          setProduct(res.data)
        }
      } catch (err) {
        if (!cancelled) setError("ไม่สามารถโหลดสินค้าได้")
      }
    }

    load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleBack = () => navigate(-1)

  // เพิ่มลงตะกร้า
  const handleAddToCart = async () => {
    if (!product) return

    try {
      startCartLoading()

      await addCart({
        product_id: product.id,
        quantity: qty,
      })

      const res = await getCart()
      setCart(res.data)

      // TODO: toast success ถ้าต้องการ
    } catch (err) {
      console.error(err)
      setCartError("ไม่สามารถเพิ่มสินค้าในตะกร้าได้")
    }
  }

  // LOADING
  if (isLoading && !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-center text-gray-500 text-sm">กำลังโหลดสินค้า...</p>
      </main>
    )
  }

  // Error / No data
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

  // const thumbnails = [
  //   product.image_url,
  //   product.image_url,
  //   product.image_url,
  // ].filter(Boolean)
  // รวม path จาก image_url หลัก + images (ถ้ามี)
  const thumbnailPaths = [
    product.image_url,
    ...(product.images?.map((img) => img.image_url) ?? []),
  ].filter(Boolean) as string[]

// แปลง path ให้เป็น full URL ด้วย resolveImageUrl
  const thumbnails = thumbnailPaths.map((path) => resolveImageUrl(path))

// main image
  const mainImage =
    thumbnails[activeImageIndex] ||
    thumbnails[0] ||
    "https://via.placeholder.com/800"

  const handlePrevThumb = () => {
    setActiveImageIndex((prev) =>
      prev === 0 ? thumbnails.length - 1 : prev - 1
    )
  }

  const handleNextThumb = () => {
    setActiveImageIndex((prev) =>
      prev === thumbnails.length - 1 ? 0 : prev + 1
    )
  }

  const handleDecreaseQty = () => {
    setQty((prev) => (prev > 1 ? prev - 1 : 1))
  }

  const handleIncreaseQty = () => {
    setQty((prev) => prev + 1)
  }

  const storeName = `ร้านหมายเลข ${product.store_id}`

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-10">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        กลับ
      </button>

      {/* การ์ดหลักสินค้า */}
      <Card className="rounded-3xl px-6 py-6 md:px-10 md:py-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* LEFT: IMAGE + THUMB */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[420px] aspect-square overflow-hidden rounded-3xl bg-gray-50">
              <img
                src={mainImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50"
                onClick={handlePrevThumb}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex gap-3">
                {thumbnails.map((thumb, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative h-20 w-20 overflow-hidden rounded-2xl border transition
                      ${
                        index === activeImageIndex
                          ? "border-orange-500 shadow-sm"
                          : "border-transparent hover:border-gray-300"
                      }`}
                  >
                    <img
                      src={thumb}
                      alt={`thumb-${index}`}
                      className="h-full w-full object-cover"
                    />
                    {index === activeImageIndex && (
                      <span className="absolute inset-x-3 bottom-1 h-1 rounded-full bg-orange-500" />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50"
                onClick={handleNextThumb}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* RIGHT: DETAILS */}
          <section className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 text-gray-700">
              <RatingStarsFixed />
              <span className="text-sm">288 reviews</span>
            </div>

            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {product.price ? `${product.price} บาท` : "—"}
            </p>

            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description || "ไม่มีรายละเอียดสินค้า"}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <div className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={handleDecreaseQty}
                  className="px-2 text-lg leading-none text-gray-600 hover:text-gray-900"
                >
                  –
                </button>
                <span className="mx-3 w-6 text-center text-sm font-medium">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={handleIncreaseQty}
                  className="px-2 text-lg leading-none text-gray-600 hover:text-gray-900"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 min-w-[200px] rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                เพิ่มลงในตะกร้า
              </button>
            </div>

            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Heart className="h-4 w-4" />
              <span>Add to Favorite</span>
            </button>
          </section>
        </div>
      </Card>

      {/* แถบข้อมูลร้านด้านล่าง */}
      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{storeName}</p>
            <p className="text-xs text-gray-500">ร้านค้าพาร์ทเนอร์บน KMALL</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="rounded-full border border-orange-500 px-5 py-2 text-sm font-semibold text-orange-500 hover:bg-orange-50 transition">
            แชทเลย
          </button>
          <button className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">
            ดูร้านค้า
          </button>
        </div>
      </Card>
    </main>
  )
}
