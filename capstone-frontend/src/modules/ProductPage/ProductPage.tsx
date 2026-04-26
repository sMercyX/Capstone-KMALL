// src/pages/product/ProductPage.tsx
import { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, ShoppingCart, Truck } from "lucide-react"
import { toast } from "react-toastify"
import BackButton from "../../components/Buttons/BackButton"
import { useProductApi, type productPictureResponse, type Product, type Variant } from "../../api/productApi"
import { useProductStore } from "../../stores/productStore"
import { useCartStore } from "../../stores/cartStore"
import Card from "../../components/Card/Card"
import { useCartApi } from "../../api/cartApi"
import { resolveImageUrl } from "../../utils/resolve"
import StoreInfoCard from "../../components/Card/StoreInfoCard"
import { handleApiError } from "../../utils/handleApiError"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"


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
  
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [matchedVariant, setMatchedVariant] = useState<Variant | null>(null)
  
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [images, setImages] = useState<productPictureResponse[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 1. โหลด product และ images
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
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  
  // 2. พยายามหา Variant ที่ตรงกับ selection
  useEffect(() => {
    if (!product?.variants || product.variants.length === 0) {
      setMatchedVariant(null)
      return
    }
    const variant = product.variants.find(v => 
      v.is_active &&
      v.selections.every(sel => selectedOptions[sel.key] === sel.value) &&
      v.selections.length === Object.keys(selectedOptions).length
    )
    setMatchedVariant(variant || null)
  }, [selectedOptions, product?.variants])

  // 3. Load cart initially
  useEffect(() => {
    async function loadCart() {
      try {
        const res = await getCart()
        setCart(res.data)
      } catch (err) {
        console.error("Failed to load cart:", err)
      }
    }
    loadCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 4. handlers
  const handleAddToCart = async () => {
    if (!product) return
    try {
      if (cart && cart.items.length > 0) {
        const firstItem = cart.items[0]
        if (firstItem.store_id !== product.store_id) {
          setIsConfirmModalOpen(true)
          return
        }
      }
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
        variant_id: matchedVariant?.id
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
      await clearCart()
      await addCart({
        product_id: product.id,
        quantity: qty,
        variant_id: matchedVariant?.id
      })
      const res = await getCart()
      setCart(res.data)
      toast.success("Cart cleared and item added.")
    } catch (err) {
      handleApiError(err)
    }
  }

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

  // Check if an option value is available based on current selections and stock
  const isOptionValueAvailable = (keyName: string, valueLabel: string) => {
    if (!product?.variants || product.variants.length === 0) return true;
    return product.variants.some(v => {
      const matchesOtherSelections = v.selections.every(sel => {
        if (sel.key === keyName) return true;
        if (!selectedOptions[sel.key]) return true;
        return selectedOptions[sel.key] === sel.value;
      });
      const hasThisValue = v.selections.some(sel => sel.key === keyName && sel.value === valueLabel);
      return matchesOtherSelections && hasThisValue && v.is_active && v.stock_qty > 0;
    });
  };

  // 5. Render checks
  if (isLoading && !product) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-center text-gray-500 text-sm">Loading product...</p>
      </main>
    )
  }
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

  // 6. Data processing for images
  const baseDisplayImages = images.length > 0 
    ? images.map(img => resolveImageUrl(img.image_url))
    : product.image_url 
        ? [resolveImageUrl(product.image_url)] 
        : ["/images/default-store.png"]

  const optionImages: string[] = []
  product.options?.forEach(opt => {
    opt.values.forEach(val => {
        if (val.image_url) {
            const url = resolveImageUrl(val.image_url)
            if (!optionImages.includes(url) && !baseDisplayImages.includes(url)) {
                optionImages.push(url)
            }
        }
    })
  })
  const finalDisplayImages = [...baseDisplayImages, ...optionImages]
  const isAllOptionsSelected = product.options?.length ? product.options.every(opt => selectedOptions[opt.key_name]) : true

  return (
    <main className="max-w-6xl mx-auto px-4 py-4 md:py-8 space-y-6">
      <BackButton />
      <Card className="rounded-3xl px-6 py-6 md:px-10 md:py-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* LEFT: IMAGE SECTION */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[420px] aspect-square overflow-hidden rounded-3xl bg-gray-50">
              <img
                src={finalDisplayImages[activeImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {finalDisplayImages.length > 1 && (
              <div className="mt-5 flex items-center gap-4">
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50" onClick={handlePrevThumb}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto py-2 px-1 max-w-[280px] scrollbar-hide scroll-smooth">
                  {finalDisplayImages.map((thumb, index) => (
                    <button key={index} type="button" onClick={() => setActiveImageIndex(index)} 
                      className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition ${index === activeImageIndex ? "border-orange-500 shadow-sm" : "border-transparent hover:border-gray-300"}`}>
                      <img src={thumb} alt={`thumb-${index}`} className="h-full w-full object-cover" />
                      {index === activeImageIndex && <span className="absolute inset-x-3 bottom-1 h-1 rounded-full bg-orange-500" />}
                    </button>
                  ))}
                </div>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50" onClick={handleNextThumb}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          {/* RIGHT: CONTENT SECTION */}
          <section className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3 text-gray-700">
              <span className="text-md font-semibold text-orange-500">{product.category_name}</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {matchedVariant ? `฿ ${matchedVariant.final_price}` : product.price ? `฿ ${product.price}` : "—"}
            </p>

            <p className="text-sm text-gray-600 leading-relaxed">{product.description || "No product description."}</p>

            {/* Options Selection (STOCK Only) */}
            {product.product_type === "STOCK" && product.options && product.options.length > 0 && (
              <div className="space-y-6 py-4">
                {product.options.map((opt) => (
                  <div key={opt.id} className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900">{opt.key_name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((val) => {
                        const isSelected = selectedOptions[opt.key_name] === val.value_label
                        const isAvailable = isOptionValueAvailable(opt.key_name, val.value_label)
                        return (
                          <button 
                            key={val.id} 
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              setSelectedOptions(prev => {
                                  const newSelections = { ...prev };
                                  if (newSelections[opt.key_name] === val.value_label) delete newSelections[opt.key_name];
                                  else newSelections[opt.key_name] = val.value_label;
                                  return newSelections;
                              });
                              if (val.image_url) {
                                  const resolvedUrl = resolveImageUrl(val.image_url);
                                  const imgIdx = finalDisplayImages.indexOf(resolvedUrl);
                                  if (imgIdx !== -1) {
                                      setActiveImageIndex(imgIdx);
                                      if (scrollContainerRef.current) {
                                          const thumbEl = scrollContainerRef.current.children[imgIdx] as HTMLElement;
                                          if (thumbEl) scrollContainerRef.current.scrollTo({
                                              left: thumbEl.offsetLeft - scrollContainerRef.current.offsetWidth / 2 + thumbEl.offsetWidth / 2,
                                              behavior: "smooth"
                                          });
                                      }
                                  }
                              }
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                              isSelected 
                                ? "border-orange-500 bg-orange-50 text-orange-600 ring-1 ring-orange-500 font-bold" 
                                : isAvailable
                                  ? "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                  : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                            }`}
                          >
                            {opt.is_image_key && val.image_url && (
                                <img 
                                    src={resolveImageUrl(val.image_url)} 
                                    alt={val.value_label} 
                                    className={`w-8 h-8 rounded object-cover ${!isAvailable ? "grayscale" : ""}`} 
                                />
                            )}
                            <span className={`text-sm font-medium px-1 ${!isAvailable ? "line-through" : ""}`}>
                                {val.value_label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* Availability & Delivery Status Line (Single Line) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pt-4 border-t border-gray-100 mb-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span className={`font-semibold ${product.delivery_round_university_enabled ? "text-gray-900" : "text-gray-400"}`}>
                  {product.delivery_round_university_enabled 
                    ? `Delivery available ฿${product.round_uni_base_fee || 0}`
                    : "No delivery service"}
                </span>
              </div>
              
              <div className="h-4 w-px bg-gray-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                {isAllOptionsSelected && matchedVariant ? (
                  <span className={`font-semibold ${matchedVariant.stock_qty > 0 ? "text-gray-900" : "text-red-500"}`}>
                    Stock: {matchedVariant.stock_qty > 0 ? `${matchedVariant.stock_qty} units` : "Out of Stock"}
                  </span>
                ) : (
                  <span className="text-gray-400 font-medium italic">Select options to see stock</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <div className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-2">
                <button type="button" onClick={handleDecreaseQty} className="px-2 text-lg leading-none text-gray-600 hover:text-gray-900">–</button>
                <span className="mx-3 w-6 text-center text-sm font-medium">{qty}</span>
                <button type="button" onClick={handleIncreaseQty} className="px-2 text-lg leading-none text-gray-600 hover:text-gray-900">+</button>
              </div>
              <button 
                type="button" 
                onClick={handleAddToCart} 
                disabled={!isAllOptionsSelected || (matchedVariant !== null && matchedVariant.stock_qty <= 0)}
                className={`flex-1 min-w-[200px] rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition inline-flex items-center justify-center gap-2 
                ${isAllOptionsSelected && (!matchedVariant || matchedVariant.stock_qty > 0)
                    ? "bg-orange-500 text-white hover:bg-orange-600" 
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                {!isAllOptionsSelected 
                    ? "Please select all options" 
                    : matchedVariant && matchedVariant.stock_qty <= 0 
                        ? "Out of stock" 
                        : "Add to cart"}
              </button>
            </div>
          </section>
        </div>
      </Card>
      {product.store_id && <StoreInfoCard storeId={product.store_id} disableViewButton={false} />}
      <ConfirmationModal isOpen={isConfirmModalOpen} title="Switch store?" message="Your cart contains items from a different store. If you continue, your cart will be cleared." confirmText="Yes, clear cart" cancelText="Cancel" onConfirm={handleConfirmClearCart} onClose={() => setIsConfirmModalOpen(false)} variant="danger" />
    </main>
  )
}
