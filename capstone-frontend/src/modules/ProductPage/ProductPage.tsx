// src/pages/ProductPage.tsx
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Heart, ChevronLeft, ChevronRight, Star, StarHalf } from "lucide-react"
// 👇 ปรับ path ตรงนี้ให้ตรงกับไฟล์ที่เก็บ PRODUCTS จริง

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  type Product = {
    id: string
    name: string
    shop: string
    price: number
    rating: number
    ratingCount: number
    image: string
    badge?: string
    category: string
  }
  
  const PRODUCTS: Product[] = [
    // --- Food & Drinks ---
    {
      id: "p1",
      name: "ข้าวคลุกน้ำพริกกะปิ",
      shop: "Twenty Yum",
      price: 50,
      rating: 4.2,
      ratingCount: 4231,
      image:
        "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
      badge: "โปรโมชั่น",
      category: "food",
    },
    {
      id: "p2",
      name: "ชาเขียวปั่น",
      shop: "Kami",
      price: 65,
      rating: 4.1,
      ratingCount: 751,
      image:
        "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1200&auto=format&fit=crop",
      badge: "สินค้ามาใหม่",
      category: "food",
    },

    // --- Clothes ---
    {
      id: "c1",
      name: "เสื้อยืดลายมอเตอร์ไซค์",
      shop: "StreetStyle",
      price: 199,
      rating: 4.5,
      ratingCount: 912,
      image:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop",
      category: "clothes",
    },
    {
      id: "c2",
      name: "กางเกงยีนส์",
      shop: "UrbanDenim",
      price: 499,
      rating: 4.3,
      ratingCount: 221,
      image:
        "https://images.unsplash.com/photo-1593032465171-cf66f818d9d3?q=80&w=1200&auto=format&fit=crop",
      category: "clothes",
    },

    // --- Handmade ---
    {
      id: "h1",
      name: "กระเป๋าสานแฮนด์เมด",
      shop: "Craft Studio",
      price: 350,
      rating: 4.8,
      ratingCount: 84,
      image:
        "https://images.unsplash.com/photo-1582738412294-d4e6d2b1a2d6?q=80&w=1200&auto=format&fit=crop",
      category: "handmade",
    },
    {
      id: "h2",
      name: "พวงกุญแจไม้แกะสลัก",
      shop: "Local Art",
      price: 129,
      rating: 4.6,
      ratingCount: 40,
      image:
        "https://images.unsplash.com/photo-1609521318535-678e9c5a6c9f?q=80&w=1200&auto=format&fit=crop",
      category: "handmade",
    },
  ]

  const product = PRODUCTS.find((p) => p.id === id)

  // ถ้าไม่เจอสินค้า
  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          ← กลับ
        </button>
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
          ไม่พบสินค้า
        </div>
      </main>
    )
  }

  // mock รูปภาพหลายรูป (ตอนต่อจริงให้ใช้ product.images)
  const images = [product.image, product.image, product.image]
  const [activeIndex, setActiveIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [favorite, setFavorite] = useState(false)

  const activeImage = images[activeIndex]

  const decQty = () => setQty((q) => Math.max(1, q - 1))
  const incQty = () => setQty((q) => q + 1)

  const nextThumb = () => setActiveIndex((i) => (i + 1) % images.length)
  const prevThumb = () =>
    setActiveIndex((i) => (i - 1 + images.length) % images.length)

  function RatingStars({ rating }: { rating: number }) {
    const full = Math.floor(rating)
    const half = rating - full >= 0.5
    const empty = 5 - full - (half ? 1 : 0)
    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f-${i}`} className="h-4 w-4 fill-current" />
        ))}
        {half && <StarHalf className="h-4 w-4 fill-current" />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e-${i}`} className="h-4 w-4" />
        ))}
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="rounded-3xl border bg-white p-4 md:p-6 lg:p-8 shadow-sm">
        {/* Back arrow */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Main layout */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* Left: gallery */}
          <section className="flex flex-col items-center">
            {/* Main image */}
            <div className="aspect-square w-full max-w-lg overflow-hidden rounded-2xl border bg-gray-50">
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Thumbnails */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={prevThumb}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-300 text-orange-500 hover:bg-orange-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex gap-3">
                {images.map((img, index) => {
                  const isActive = index === activeIndex
                  return (
                    <button
                      key={index}
                      onClick={() => setActiveIndex(index)}
                      className={`relative h-20 w-20 overflow-hidden rounded-xl border transition ${
                        isActive
                          ? "border-orange-500 shadow-[0_0_0_2px_rgba(248,113,113,0.3)]"
                          : "border-gray-200 hover:border-orange-300"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`thumb-${index}`}
                        className="h-full w-full object-cover"
                      />
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-orange-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={nextThumb}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-300 text-orange-500 hover:bg-orange-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Right: product info */}
          <section className="space-y-4 md:space-y-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <RatingStars rating={product.rating} />
                <span className="text-xs text-gray-500">
                  {product.rating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">
                  {product.ratingCount.toLocaleString()} reviews
                </span>
              </div>
            </div>

            <p className="text-xl font-semibold text-gray-900">
              {product.price} บาท
            </p>

            <div className="h-px w-full bg-gray-200" />

            {/* description (mock text) */}
            <p className="text-sm leading-relaxed text-gray-600">
              บราวนี่เนื้อนุ่มเข้มข้นรสช็อกโกแลตจากโกโก้แท้ ผสมช็อกโกแลตเข้มข้น
              70% หวานกำลังดี หอมเนยสด เนื้อแน่นแต่ยังฉ่ำ รสชาติกลมกล่อม
              เหมาะสำหรับทานคู่กับกาแฟหรือชานม ทำสดใหม่ทุกวันจากร้าน{" "}
              {product.shop}
            </p>

            {/* qty + add to cart */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* qty selector */}
              <div className="inline-flex items-center gap-3 rounded-full border px-3 py-1.5">
                <button
                  onClick={decQty}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  –
                </button>
                <span className="w-6 text-center text-sm font-medium">
                  {qty}
                </span>
                <button
                  onClick={incQty}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  +
                </button>
              </div>

              <button className="flex-1 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
                เพิ่มลงในตะกร้า
              </button>
            </div>

            {/* favorite */}
            <button
              onClick={() => setFavorite((f) => !f)}
              className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-orange-500"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                  favorite
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                <Heart
                  className="h-3.5 w-3.5"
                  fill={favorite ? "currentColor" : "none"}
                />
              </span>
              Add to Favorite
            </button>
          </section>
        </div>

        {/* Divider */}
        <div className="mt-8 h-px w-full bg-gray-200" />

        {/* Shop section */}
        <section className="mt-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100">
              {/* แทนด้วยโลโก้ร้านจริงได้ */}
              <img
                src={product.image}
                alt={product.shop}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">ร้าน{product.shop}</p>
              <p className="text-xs text-gray-500">
                ร้านขายขนมหวาน / เครื่องดื่มโฮมเมด
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="rounded-full border border-orange-500 px-4 py-2 text-sm font-medium text-orange-500 hover:bg-orange-50">
              แชทเลย
            </button>
            <button className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
              ดูร้านค้า
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
