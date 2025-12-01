// src/pages/product/ProductPage.tsx
import { useEffect, useState, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
} from "lucide-react"
import { toast } from "react-toastify"
import { useProductApi, type productPictureResponse } from "../../api/productApi"
import { useProductStore } from "../../stores/productStore"
import { useCartStore } from "../../stores/cartStore"
import Card from "../../components/Card/Card"
import { useCartApi } from "../../api/cartApi"
// import { resolveImageUrl } from "../../utils/resolve"
import StoreInfoCard from "../../components/Card/StoreInfoCard"


// ====== UI Helpers ======
// function RatingStarsFixed() {
//   const full = 4
//   const empty = 1

//   return (
//     <div className="flex items-center gap-0.5 text-amber-500">
//       {Array.from({ length: full }).map((_, i) => (
//         <Star key={`f-${i}`} className="h-5 w-5 fill-current" />
//       ))}
//       {Array.from({ length: empty }).map((_, i) => (
//         <Star key={`e-${i}`} className="h-5 w-5" />
//       ))}
//     </div>
//   )
// }

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { getProduct, getProductImage } = useProductApi()
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
  } = useCartStore()

  const [qty, setQty] = useState(1)
  
  // ... (existing state)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [images, setImages] = useState<productPictureResponse[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // โหลด product และ images
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
        const [productRes, imageRes] = await Promise.all([
            getProduct(productId),
            getProductImage(productId)
        ])

        if (!cancelled) {
          setProduct(productRes.data as any)
          setImages(imageRes.data || [])
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
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 403) {
        toast.error("ไม่สามารถซื้อสินค้าจากร้านตัวเองได้")
      } else {
        toast.error("ไม่สามารถเพิ่มสินค้าในตะกร้าได้")
      }
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


//   const thumbnailPaths = [
//     product.image_url,
//     ...(product.images?.map((img) => img.image_url) ?? []),
//   ].filter(Boolean) as string[]

// // แปลง path ให้เป็น full URL ด้วย resolveImageUrl
//   const thumbnails = thumbnailPaths.map((path) => resolveImageUrl(path))



  const displayImages = images.length > 0 
    ? images.map(img => `http://localhost:8000${img.image_url}`)
    : product?.image_url 
        ? [`http://localhost:8000${product.image_url}`] 
        : ["/images/default-store.png"]


  const handlePrevThumb = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -100, behavior: "smooth" })
    }
  }

  const handleNextThumb = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 100, behavior: "smooth" })
    }
  }

  const handleDecreaseQty = () => {
    setQty((prev) => (prev > 1 ? prev - 1 : 1))
  }

  const handleIncreaseQty = () => {
    setQty((prev) => prev + 1)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
      {/* ... (back button) */}
      
      <Card className="rounded-3xl px-6 py-6 md:px-10 md:py-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* LEFT: IMAGE + THUMB */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[420px] aspect-square overflow-hidden rounded-3xl bg-gray-50">
              <img
                src={displayImages[activeImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>

            {displayImages.length > 1 && (
                <div className="mt-5 flex items-center gap-4">
                <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50"
                    onClick={handlePrevThumb}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                <div 
                  ref={scrollContainerRef}
                  className="flex gap-3 overflow-x-auto py-2 px-1 max-w-[280px] scrollbar-hide scroll-smooth"
                >
                    {displayImages.map((thumb, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition
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
            )}
          </section>


          {/* RIGHT: DETAILS */}
          <section className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {product.name}
            </h1>
{/* 
            <div className="flex items-center gap-3 text-gray-700">
              <RatingStarsFixed />
              <span className="text-sm">288 reviews</span>
            </div> */}

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

          </section>
        </div>
      </Card>

      {/* แถบข้อมูลร้านด้านล่าง */}
      {/* แถบข้อมูลร้านด้านล่าง */}
      {product?.store_id && <StoreInfoCard storeId={product.store_id} />}
    </main>
  )
}
