// src/pages/Store/StoreAddTab/StoreAddTab.tsx
import { useRef, useState } from "react"
import {
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react"

import { useProductApi, type AddProductRequest } from "../../../api/productApi"
import { useStoreStore } from "../../../stores/storeStore"

type ImageSlot = string

export function StoreAddTab() {
  const [images, setImages] = useState<ImageSlot[]>([])
  const [mainIndex, setMainIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const thumbsRef = useRef<HTMLDivElement | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState<string>("")
  const [categoryId, setCategoryId] = useState<number>(1) // 1=food

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addProduct } = useProductApi()
  const { store } = useStoreStore() // ต้องมี store.id จาก /api/stores/me

  // ---------- image handlers (เหมือนเดิม) ----------
  const handleClickAddImages = () => {
    fileInputRef.current?.click()
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newUrls = Array.from(files).map((file) =>
      URL.createObjectURL(file)
    )

    setImages((prev) => {
      const next = [...prev, ...newUrls]
      if (prev.length === 0 && next.length > 0) {
        setMainIndex(0)
      }
      return next
    })

    e.target.value = ""
  }

  const handleSelectMain = (index: number) => {
    if (index === mainIndex) return
    const ok = window.confirm("คุณต้องการนำภาพนี้เป็นรูปใหญ่ใช่หรือไม่?")
    if (!ok) return
    setMainIndex(index)
  }

  const handleDeleteImage = (index: number) => {
    const ok = window.confirm("คุณต้องการลบรูปภาพนี้ใช่หรือไม่?")
    if (!ok) return

    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index)

      if (next.length === 0) {
        setMainIndex(0)
        return next
      }

      if (index === mainIndex) {
        setMainIndex(0)
      } else if (index < mainIndex) {
        setMainIndex((prevMain) => prevMain - 1)
      }

      return next
    })
  }

  const scrollThumbs = (direction: "left" | "right") => {
    const el = thumbsRef.current
    if (!el) return
    const amount = direction === "left" ? -120 : 120
    el.scrollBy({ left: amount, behavior: "smooth" })
  }

  const mainImage = images[mainIndex]

  // ---------- submit product ----------
  const handleSave = async () => {
    setError(null)

    if (!store?.id) {
      setError("ไม่พบร้านของคุณ กรุณารีเฟรชหน้า")
      return
    }

    if (!name.trim()) {
      setError("กรุณากรอกชื่อสินค้า")
      return
    }

    const priceNumber = Number(price)
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      setError("กรุณากรอกราคาให้ถูกต้อง")
      return
    }

    try {
      setIsSubmitting(true)

      const payload: AddProductRequest = {
        name,
        description,
        price: priceNumber,
        image_url: "", // ✅ ตอนนี้ยังไม่ทำอัปโหลดรูป ส่งค่าว่างไปก่อน
        is_active: "YES",
        store_id: store.id,
        category_id: categoryId,
      }

      const res = await addProduct(payload)
      console.log("PRODUCT CREATED:", res)

      // reset ฟอร์มง่าย ๆ
      setName("")
      setDescription("")
      setPrice("")
      setImages([])
      setMainIndex(0)
      alert("เพิ่มสินค้าเรียบร้อยแล้ว")
    } catch (err) {
      console.error(err)
      setError("เพิ่มสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* ===== LEFT: IMAGES ===== */}
      <div>
        <div className="w-full aspect-square rounded-2xl bg-[#f8f8f8] border border-gray-200 flex items-center justify-center overflow-hidden">
          {mainImage ? (
            <img
              src={mainImage}
              alt="product main"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400 text-sm">
              ภาพหลักของสินค้า
            </span>
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
            className="flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
          >
            {images.length === 0 &&
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#f8f8f8] border border-gray-200 flex items-center justify-center text-[11px] text-gray-300 flex-shrink-0"
                >
                  รูป {i + 1}
                </div>
              ))}

            {images.map((img, index) => {
              if (index === mainIndex) return null
              return (
                <div
                  key={index}
                  className="relative w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#f8f8f8] border border-gray-200 overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={() => handleSelectMain(index)}
                >
                  <img
                    src={img}
                    alt={`product-${index}`}
                    className="w-full h-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteImage(index)
                    }}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-sm hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-600" />
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
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-500 text-orange-500 text-sm font-medium bg-white shadow-sm hover:bg-orange-50"
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
      <div className="flex flex-col justify-between">
        <div className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-800">
              ชื่อสินค้า
            </label>
            <input
              type="text"
              placeholder="Product Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-800">
              คำอธิบายสินค้า
            </label>
            <textarea
              placeholder="Product Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-800">
              ราคา
            </label>
            <input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-800">
              หมวดหมู่
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value={1}>อาหารและเครื่องดื่ม</option>
              <option value={2}>เสื้อผ้า</option>
              <option value={3}>สินค้าแฮนด์เมด</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-500 pt-1">{error}</p>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold shadow-md hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}
