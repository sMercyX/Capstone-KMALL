// src/pages/Store/StoreProductsTab/StoreProductsTab.tsx
import { useEffect } from "react"
import { Pencil, Trash2 } from "lucide-react"
import Pagination from "../../../components/Pagination/Pagination"
import { useStoreApi } from "../../../api/storeApi"
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

  const handleEdit = (id: number) => {
    console.log("edit product", id)
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
                  <img
                    src={
                      product.image_url ||
                      "https://via.placeholder.com/150?text=Product"
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
                      onClick={() => handleEdit(product.id)}
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
    </>
  )
}
