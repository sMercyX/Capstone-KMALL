// src/pages/product/ProductPage.tsx
import { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"
import { toast } from "react-toastify"
import BackButton from "../../components/Buttons/BackButton"
import { useProductApi, type productPictureResponse, type Product } from "../../api/productApi"
import { useProductStore } from "../../stores/productStore"
import { useCartStore } from "../../stores/cartStore"
import Card from "../../components/Card/Card"
import { useCartApi } from "../../api/cartApi"
import { resolveImageUrl } from "../../utils/resolve"
import StoreInfoCard from "../../components/Card/StoreInfoCard"
import { handleApiError } from "../../utils/handleApiError"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"


// ====== UI Helpers ======
// function RatingStarsFixed() {
//   const full = 4
//   const empty = 1
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

  const { addCart, getCart, clearCart } = useCartApi()
  const {
    cart,
    startLoading: startCartLoading,
    setCart,
  } = useCartStore()

  const [qty, setQty] = useState(1)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  
  // ... (existing state)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [images, setImages] = useState<productPictureResponse[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // โหลด product และ images
  useEffect(() => {
    if (!id) {
      setError("Product not found.")
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
          setProduct(productRes.data as Product)
          setImages(imageRes.data || [])
        }
      } catch {
        if (!cancelled) setError("Unable to load product.")
      }
    }

    load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])



  // เพิ่มลงตะกร้า
  const handleAddToCart = async () => {
    if (!product) return

    try {
      // 1) เช็คว่ามีสินค้าในตะกร้าหรือไม่
      if (cart && cart.items.length > 0) {
        // สมมติว่าในตะกร้ามีสินค้าจากร้านเดียวกันหมด (หรือเช็คตัวแรก)
        const firstItem = cart.items[0]
        if (firstItem.store_id !== product.store_id) {
          // คนละร้าน -> เปิด Modal ถาม
          setIsConfirmModalOpen(true)
          return
        }
      }

      // Check existing quantity in cart
      const existingItem = cart?.items.find(item => item.product_id === product.id)
      const currentQty = existingItem ? existingItem.quantity : 0
      
      if (currentQty + qty > 99) {
        toast.warn(`You already have ${currentQty} in your cart. Adding ${qty} would exceed the 99-item limit.`)
        return
      }

      startCartLoading()

      await addCart({
        product_id: product.id,
        quantity: qty,
      })

      const res = await getCart()
      setCart(res.data)

      toast.success("Added to cart.")
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleConfirmClearCart = async () => {
    if (!product) return
    try {
      setIsConfirmModalOpen(false)
      startCartLoading()

      // 1. ล้างตะกร้า
      await clearCart()

      // 2. เพิ่มสินค้าใหม่
      await addCart({
        product_id: product.id,
        quantity: qty,
      })

      // 3. โหลดตะกร้าใหม่
      const res = await getCart()
      setCart(res.data)

      toast.success("Cart cleared and item added.")
    } catch (err) {
      handleApiError(err)
    }
  }

  // LOADING
  if (isLoading && !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-center text-gray-500 text-sm">Loading product...</p>
      </main>
    )
  }

  // Error / No data
  if (error || !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <BackButton className="mb-4" />

        <div className="rounded-xl border bg-white p-8 text-center text-red-500">
          {error || "Product not found."}
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
    ? images.map(img => resolveImageUrl(img.image_url))
    : product?.image_url 
        ? [resolveImageUrl(product.image_url)] 
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
    if (qty >= 99) {
      toast.warn("You can buy up to 99 units per item.")
      return
    }
    setQty((prev) => prev + 1)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
      {/* Back Button */}
      {/* Back Button */}
      <BackButton className="mb-4" />
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
            <div className="flex items-center gap-3 text-gray-700">
              <span className="text-md font-semibold text-orange-500">{product.category_name}</span>
            </div>
{/* 
            <div className="flex items-center gap-3 text-gray-700">
              <RatingStarsFixed />
              <span className="text-sm">288 reviews</span>
            </div> */}

            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {product.price ? `฿ ${product.price}` : "—"}
            </p>

            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description || "No product description."}
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
                Add to cart
              </button>
            </div>

          </section>
        </div>
      </Card>

      {/* แถบข้อมูลร้านด้านล่าง */}
      {product?.store_id && <StoreInfoCard storeId={product.store_id} disableViewButton={false} />}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        title="Switch store?"
        message="Your cart contains items from a different store. If you continue, your cart will be cleared. Do you want to continue?"
        confirmText="Yes, clear cart"
        cancelText="Cancel"
        onConfirm={handleConfirmClearCart}
        onClose={() => setIsConfirmModalOpen(false)}
        variant="danger"
      />
    </main>
  )
}
