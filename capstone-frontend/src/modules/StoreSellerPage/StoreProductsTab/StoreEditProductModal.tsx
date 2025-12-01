import { useEffect, useRef, useState } from "react"
import {
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Save,
} from "lucide-react"
import { toast } from "react-toastify"

import { Input } from "../../../components/Input/Input"
import { Textarea } from "../../../components/Input/Textarea"
import { handleApiError } from "../../../utils/handleApiError"
import { resolveImageUrl } from "../../../utils/resolve"

import {
  useProductApi,
  type productPictureResponse,
} from "../../../api/productApi"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import { type storeProductDataRequset } from "../../../api/storeApi"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"

interface StoreEditProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: storeProductDataRequset
  onSuccess: () => void
}

type ImageItem = {
  type: "EXISTING" | "NEW"
  id?: number // for EXISTING
  url: string
  file?: File // for NEW
}

export default function StoreEditProductModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StoreEditProductModalProps) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [deletedIds, setDeletedIds] = useState<number[]>([])
  const [mainIndex, setMainIndex] = useState(0)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState<string>("")
  const [categoryId, setCategoryId] = useState<number>(0)
  const [isActive, setIsActive] = useState<"YES" | "NO">("YES")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Validation state
  const [errors, setErrors] = useState<{ name?: boolean; price?: boolean; category?: boolean; description?: boolean; images?: boolean }>({})

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const thumbsRef = useRef<HTMLDivElement | null>(null)

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: "danger" | "warning" | "info"
    onConfirm: () => void
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
    onConfirm: () => {},
  })

  // API hooks
  const {
    editProduct: updateProduct,
    addImageProduct,
    editImageProduct,
    getProductImage,
    deleteProductImage,
  } = useProductApi()
  const { getCatagoriesSubName } = useCatagoriesApi()

  const [categories, setCategories] = useState<CatagoriesResponse[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // 1. Load Categories
  useEffect(() => {
    if (!isOpen) return
    const loadCats = async () => {
      setLoadingCategories(true)
      try {
        const res = await getCatagoriesSubName()
        setCategories(res.data ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCats()
  }, [isOpen])

  // 2. Load Product Data & Images
  useEffect(() => {
    if (!isOpen || !product) return

    // Reset state
    setName(product.name ?? "")
    setDescription(product.description ?? "")
    setPrice(String(product.price ?? ""))
    setCategoryId(Number(product.category_id) || 0)
    setIsActive(product.is_active ?? "YES")
    setImages([])
    setDeletedIds([])
    setMainIndex(0)
    setError(null)
    setErrors({})

    // Fetch images
    const fetchImages = async () => {
      try {
        const res = await getProductImage(product.id)
        const apiImages = res.data || []
        
        // Convert to ImageItem
        // Sort by sort_order if needed, but usually backend sends sorted
        const items: ImageItem[] = apiImages.map((img) => ({
          type: "EXISTING",
          id: img.id,
          url: resolveImageUrl(img.image_url), // backend sends /static/...
        }))

        setImages(items)

        // Find primary
        const primaryIdx = apiImages.findIndex((img) => img.is_primary)
        if (primaryIdx >= 0) {
          setMainIndex(primaryIdx)
        } else {
          setMainIndex(0)
        }
      } catch (err) {
        console.error("Failed to load images:", err)
        // Fallback: use product.image_url if available
        if (product.image_url) {
            // If API fails, we might not have ID, so treat as existing but maybe careful
            // Actually better to just show error or empty
        }
      }
    }

    fetchImages()
  }, [isOpen, product])

  if (!isOpen) return null

  // --- Handlers ---

  const handleClickAddImages = () => {
    fileInputRef.current?.click()
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    const validFiles: File[] = []
    Array.from(selectedFiles).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`ไฟล์ ${file.name} มีขนาดเกิน 2MB`)
        return
      }
      validFiles.push(file)
    })

    if (validFiles.length === 0) {
      e.target.value = ""
      return
    }

    const newItems: ImageItem[] = validFiles.map((file) => ({
      type: "NEW",
      url: URL.createObjectURL(file),
      file,
    }))

    setImages((prev) => {
      const next = [...prev, ...newItems]
      // If we had no images, set first new one as main
      if (prev.length === 0 && next.length > 0) {
        setMainIndex(0)
      }
      return next
    })

    e.target.value = ""
  }

  const handleSelectMain = (index: number) => {
    if (index === mainIndex) return
    
    setConfirmModal({
      isOpen: true,
      title: "เปลี่ยนรูปหลัก",
      message: "คุณต้องการเปลี่ยนรูปนี้ให้เป็นรูปหลักใช่หรือไม่?",
      variant: "warning",
      onConfirm: () => setMainIndex(index),
    })
  }

  const handleDeleteImage = (index: number) => {
    setConfirmModal({
      isOpen: true,
      title: "ลบรูปภาพ",
      message: "คุณต้องการลบรูปภาพนี้ใช่หรือไม่?",
      variant: "danger",
      onConfirm: () => {
        const target = images[index]
        if (target.type === "EXISTING" && target.id) {
          setDeletedIds((prev) => [...prev, target.id!])
        }

        setImages((prev) => {
          const next = prev.filter((_, i) => i !== index)
          if (next.length === 0) {
            setMainIndex(0)
          } else if (index === mainIndex) {
            setMainIndex(0)
          } else if (index < mainIndex) {
            setMainIndex((prevMain) => prevMain - 1)
          }
          return next
        })
      },
    })
  }

  const scrollThumbs = (direction: "left" | "right") => {
    const el = thumbsRef.current
    if (!el) return
    const amount = direction === "left" ? -120 : 120
    el.scrollBy({ left: amount, behavior: "smooth" })
  }

  const handleSave = async () => {
    setError(null)
    setErrors({})
    
    const newErrors: { name?: boolean; price?: boolean; category?: boolean; description?: boolean; images?: boolean } = {}
    let hasError = false

    if (!name.trim()) {
      newErrors.name = true
      hasError = true
      toast.error("กรุณากรอกชื่อสินค้า")
    }

    if (!description.trim()) {
      newErrors.description = true
      hasError = true
      toast.error("กรุณากรอกคำอธิบายสินค้า")
    }

    const priceNum = Number(price)
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = true
      hasError = true
      toast.error("ราคาไม่ถูกต้อง")
    }
    
    if (!categoryId) {
      newErrors.category = true
      hasError = true
      toast.error("กรุณาเลือกหมวดหมู่สินค้า")
    }

    // Check if there are any images left (excluding deleted ones, but here images state reflects current UI)
    if (images.length === 0) {
      newErrors.images = true
      hasError = true
      toast.error("กรุณาเพิ่มรูปภาพสินค้าอย่างน้อย 1 รูป")
    }

    if (hasError) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Delete removed images
      for (const id of deletedIds) {
        await deleteProductImage(id)
      }

      // 2. Update Product Info
      await updateProduct(product.id, {
        name: name.trim(),
        description: description,
        price: priceNum,
        image_url: product.image_url || "", // keep old one or empty, backend should sync
        category_id: categoryId,
        is_active: isActive,
      })

      // 3. Upload NEW images
      const newFiles = images
        .filter((img) => img.type === "NEW" && img.file)
        .map((img) => img.file!)

      let uploadedNewImages: productPictureResponse[] = []
      if (newFiles.length > 0) {
        const res = await addImageProduct(product.id, newFiles)
        uploadedNewImages = res.data
      }

      // 4. Set Primary Image
      const mainImageItem = images[mainIndex]

      if (mainImageItem) {
        let targetImageId: number | undefined

        if (mainImageItem.type === "EXISTING") {
          targetImageId = mainImageItem.id
        } else {
          // It's a NEW image. We need to find its ID from uploadedNewImages.
          const newImagesInState = images.filter((img) => img.type === "NEW")
          const indexInNew = newImagesInState.indexOf(mainImageItem)
          
          if (indexInNew >= 0 && uploadedNewImages[indexInNew]) {
            targetImageId = uploadedNewImages[indexInNew].id
          }
        }

        if (targetImageId) {
          await editImageProduct(targetImageId, { is_primary: true })
        }
      }

      toast.success("บันทึกข้อมูลสำเร็จ")
      onSuccess()
      onClose()
    } catch (err) {
      handleApiError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const mainImageSrc = images[mainIndex]?.url 
    ? (images[mainIndex].type === "EXISTING" ? resolveImageUrl(images[mainIndex].url) : images[mainIndex].url)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div >
        <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-orange-50 to-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">
                Edit Product
              </p>
              <h3 className="text-xl font-bold text-gray-900">
                {product.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* ===== LEFT: IMAGES ===== */}
            <div>
              <div className={`w-full aspect-square rounded-2xl bg-[#f8f8f8] border flex items-center justify-center overflow-hidden relative ${
                errors.images ? "border-red-500" : "border-gray-200"
              }`}>
                {mainImageSrc ? (
                  <img
                    src={mainImageSrc}
                    alt="product main"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-sm">
                    ภาพหลักของสินค้า
                  </span>
                )}
                {mainImageSrc && (
                   <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                      Main Image
                   </div>
                )}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollThumbs("left")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={thumbsRef}
                  className="flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent py-2"
                >
                  {images.length === 0 && (
                     <div className="text-xs text-gray-400 w-full text-center py-4">ไม่มีรูปภาพ</div>
                  )}

                  {images.map((img, index) => {
                    const isMain = index === mainIndex
                    const src = img.type === "EXISTING" ? resolveImageUrl(img.url) : img.url
                    
                    return (
                      <div
                        key={index}
                        className={`relative w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#f8f8f8] border overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                          isMain ? "border-orange-500 ring-2 ring-orange-200" : "border-gray-200 hover:border-orange-300"
                        }`}
                        onClick={() => handleSelectMain(index)}
                      >
                        <img
                          src={src}
                          alt={`thumb-${index}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {img.type === "NEW" && (
                          <div className="absolute bottom-0 left-0 right-0 bg-green-500/80 text-white text-[10px] text-center py-0.5">
                              New
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteImage(index)
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-sm hover:bg-red-50 z-10"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollThumbs("right")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleClickAddImages}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-500 text-orange-500 text-sm font-medium bg-white shadow-sm hover:bg-orange-50 w-full justify-center md:w-auto"
              >
                <ImagePlus className="w-4 h-4" />
                <span>เพิ่มรูปภาพ</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </div>

            {/* ===== RIGHT: FORM ===== */}
            <div className="flex flex-col h-full">
              <div className="space-y-5 flex-1">
                <Input
                  label="ชื่อสินค้า"
                  placeholder="Product Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                />

                <Textarea
                  label="คำอธิบายสินค้า"
                  placeholder="Product Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-28"
                  error={errors.description}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Input
                        label="ราคา"
                        type="number"
                        placeholder="Price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        error={errors.price}
                      />
                  </div>
                  <div>
                      <label className="block mb-1 text-sm font-semibold text-gray-800">
                      สถานะ
                      </label>
                      <select
                          value={isActive}
                          onChange={(e) => setIsActive(e.target.value as "YES" | "NO")}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                          <option value="YES">แสดงสินค้า</option>
                          <option value="NO">ซ่อนสินค้า</option>
                      </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-semibold text-gray-800">
                    หมวดหมู่
                  </label>
                  <select
                    value={categoryId || ""}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    disabled={loadingCategories}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 bg-white ${
                        errors.category
                          ? "border-red-500 focus:ring-red-400"
                          : "border-gray-300 focus:ring-orange-400"
                      }`}
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-red-500 pt-1 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
                 <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                    disabled={isSubmitting}
                  >
                    ยกเลิก
                  </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold shadow-md hover:bg-orange-600 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  )
}
