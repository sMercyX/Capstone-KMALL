// src/pages/Store/StoreProductsTab/StoreProductsTab.tsx
import { useEffect, useState } from "react"
import { Pencil, Trash2, X, Save } from "lucide-react"
import Pagination from "../../../components/Pagination/Pagination"
import { useStoreApi, type storeProductDataRequset } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import { useStoreProductStore } from "./storeProductStore"

export default function StoreProductsTab() {
  const { getStoreProducts } = useStoreApi()
  const { store } = useStoreStore() // ต้องมี store.id จาก /api/stores/me

  const {
    items,
    pageIndex,
    pageSize,
    total,
    isLoading,
    error,
    setPageIndex,
    startLoading,
    setPageData,
    setError,
    reset,
  } = useStoreProductStore()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editProduct, setEditProduct] =
    useState<storeProductDataRequset | null>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category_id: "",
    is_active: "YES" as "YES" | "NO",
  })

  // เปลี่ยนร้าน → รีเซ็ต pagination
  useEffect(() => {
    if (!store?.id) return
    reset()
    setPageIndex(1)
  }, [store?.id, reset, setPageIndex])

  // โหลดสินค้าของร้าน (มี pagination)
  useEffect(() => {
    if (!store?.id) return

    let cancelled = false

    async function load() {
      try {
        startLoading()
        const res = await getStoreProducts(store!.id, pageIndex, pageSize)
        if (!cancelled) {
          setPageData(res.data)
        }
      } catch (err) {
        console.error("load store products failed:", err)
        if (!cancelled) {
          setError("โหลดสินค้าล้มเหลว")
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }

    // ❗ อย่าใส่ getStoreProducts / startLoading / setPageData / setError
    //    เพราะเป็นฟังก์ชันจาก hook ที่ reference เปลี่ยนทุก render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, pageIndex, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const toggleActive = (id: number, current: "YES" | "NO") => {
    // TODO: ไว้ต่อ API เปลี่ยน is_active ทีหลัง
    console.log("toggle active", id, current)
  }

  const handleOpenEdit = (product: storeProductDataRequset) => {
    setEditProduct(product)
    setForm({
      name: product.name ?? "",
      description: product.description ?? "",
      price: String(product.price ?? ""),
      image_url:
        product.image_url ||
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
      category_id: product.category_id ?? "",
      is_active: product.is_active ?? "YES",
    })
    setEditError(null)
    setIsEditOpen(true)
  }

  const handleCloseEdit = () => {
    setIsEditOpen(false)
    setEditError(null)
    setEditProduct(null)
    setEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!editProduct) return
    setEditError(null)

    if (!form.name.trim()) {
      setEditError("กรุณากรอกชื่อสินค้า")
      return
    }

    const priceNumber = Number(form.price)
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setEditError("กรุณากรอกราคาให้ถูกต้อง")
      return
    }

    setEditing(true)

    const updated: storeProductDataRequset = {
      ...editProduct,
      name: form.name.trim(),
      description: form.description,
      price: priceNumber,
      image_url: form.image_url,
      category_id: form.category_id,
      is_active: form.is_active,
    }

    const updateList = () => {
      const next = items.map((p) => (p.id === editProduct.id ? updated : p))
      setPageData({
        items: next,
        pageIndex,
        pageSize,
        total,
      })
    }

    try {
      // TODO: ต่อ API update product แล้วค่อย refresh list
      updateList()
      console.log("Save edit (real API here)", updated)
      handleCloseEdit()
    } catch (err) {
      console.error(err)
      setEditError("บันทึกไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setEditing(false)
    }
  }

  const handleDelete = (id: number) => {
    console.log("delete product", id)
  }

  return (
    <>
      <div className="border border-[#e0e0e0] rounded-2xl p-6 bg-white">
        <h2 className="font-semibold text-lg mb-4">สินค้าทั้งหมด</h2>

        {isLoading && !items.length && (
          <p className="text-center text-gray-500 py-4">กำลังโหลดสินค้า...</p>
        )}

        {error && (
          <p className="text-center text-red-500 py-4">{error}</p>
        )}

        {!isLoading && !error && !items.length && (
          <p className="text-center text-gray-500 py-4">
            ยังไม่มีสินค้าในร้านของคุณ
          </p>
        )}

        <div className="space-y-6">
          {items.map((product) => {
            const isActive = product.is_active === "YES"

            return (
              <div
                key={product.id}
                className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                {/* รูป + รายละเอียด */}
                <div className="flex items-start gap-4">
                  {/* <img
                    src={
                      product.image_url ||
                      "https://via.placeholder.com/150?text=Product"
                    }
                    alt={product.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover flex-shrink-0"
                  /> */}
                  <img
            src={
              product.image_url
                ? `http://localhost:8000${product.image_url}`
                : "/images/default-store.png"
            }
            alt={product.name}
            className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover flex-shrink-0"
          />

                  <div className="space-y-1">
                    <p className="font-semibold text-sm md:text-base">
                      {product.name}
                    </p>
                    <p className="text-xs md:text-sm text-gray-500">
                      {product.description}
                    </p>
                    <p className="text-sm md:text-base mt-1">
                      {product.price} บาท
                    </p>
                  </div>
                </div>

                {/* ปุ่ม + Toggle */}
                <div className="flex items-center justify-between md:justify-end gap-6 md:min-w-[220px]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenEdit(product)}
                      className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                    >
                      <Pencil className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isActive ? "text-sky-600" : "text-red-500"
                      }`}
                    >
                      {isActive ? "แสดงสินค้า" : "ซ่อนสินค้า"}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        toggleActive(product.id, product.is_active)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? "bg-sky-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          isActive ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Pagination
        currentPage={pageIndex}
        totalPages={totalPages}
        onPageChange={setPageIndex}
        className="mt-6"
      />

      {isEditOpen && editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-sky-50 to-white">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">
                  Edit Product
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {editProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div className="relative rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
                  <img
                    src={form.image_url || "https://via.placeholder.com/400"}
                    alt="product"
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200">
                    ID #{editProduct.id}
                  </div>
                  <div className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm border border-sky-200">
                    {form.is_active === "YES" ? "แสดงสินค้า" : "ซ่อนสินค้า"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    URL รูปภาพ
                  </label>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, image_url: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500">
                    วางลิงก์รูปเพื่อพรีวิวทันที
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    ชื่อสินค้า
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">
                      ราคา
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, price: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">
                      สถานะการแสดง
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, is_active: "YES" }))
                        }
                        className={`rounded-xl border px-3 py-2 font-semibold transition ${
                          form.is_active === "YES"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        แสดงสินค้า
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, is_active: "NO" }))
                        }
                        className={`rounded-xl border px-3 py-2 font-semibold transition ${
                          form.is_active === "NO"
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        ซ่อนสินค้า
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    คำอธิบายสินค้า
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="รายละเอียดสินค้า จุดเด่น วัสดุ ขนาด ฯลฯ"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    หมวดหมู่
                  </label>
                  <input
                    type="text"
                    value={form.category_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category_id: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="category id เช่น apparel"
                  />
                </div>

                {editError && (
                  <p className="text-sm text-red-500">{editError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50">
              <div className="text-xs text-gray-500">
                การบันทึกจะอัปเดตข้อมูลสินค้า
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-100"
                  disabled={editing}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={editing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {editing ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
