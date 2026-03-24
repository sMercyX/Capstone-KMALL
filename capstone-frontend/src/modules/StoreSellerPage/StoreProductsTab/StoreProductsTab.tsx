import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Pencil, Trash2, Plus } from "lucide-react"
import Pagination from "../../../components/Pagination/Pagination"
import { useProductApi } from "../../../api/productApi"
import { useStoreApi, type storeProductDataRequset } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import { useStoreProductStore } from "./storeProductStore"
import StoreEditProductModal from "./StoreEditProductModal"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"
import { handleApiError } from "../../../utils/handleApiError"

export default function StoreProductsTab() {
  const { getStoreProducts } = useStoreApi()
  const store = useStoreStore((s) => s.store)
  const navigate = useNavigate()

  const {
    items,
    total,
    pageIndex,
    pageSize,
    isLoading,
    error,
    setPageData,
    setPageIndex,
    startLoading,
    setError,
    reset,
  } = useStoreProductStore()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<storeProductDataRequset | null>(
    null
  )

  const [refreshKey, setRefreshKey] = useState(0)

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
          setError("Failed to load products.")
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
  }, [store?.id, pageIndex, pageSize, refreshKey])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const { editProduct: updateProduct, deleteProduct } = useProductApi()

  const toggleActive = async (id: number, current: "YES" | "NO") => {
    const product = items.find((p) => p.id === id)
    if (!product) return

    const newStatus = current === "YES" ? "NO" : "YES"

    try {
      // Optimistic update
      const nextItems = items.map((p) =>
        p.id === id ? { ...p, is_active: newStatus } : p
      )
      setPageData({
        items: nextItems,
        pageIndex,
        pageSize,
        total,
      })

      await updateProduct(id, {
        name: product.name!,
        description: product.description!,
        price: product.price!,
        image_url: product.image_url!,
        category_id: Number(product.category_id),
        is_active: newStatus,
      })
    } catch (err) {
      console.error("Failed to toggle active status:", err)
      // Revert on error
      const revertedItems = items.map((p) =>
        p.id === id ? { ...p, is_active: current } : p
      )
      setPageData({
        items: revertedItems,
        pageIndex,
        pageSize,
        total,
      })
    }
  }

  const handleOpenEdit = (product: storeProductDataRequset) => {
    setEditProduct(product)
    setIsEditOpen(true)
  }

  const handleCloseEdit = () => {
    setIsEditOpen(false)
    setEditProduct(null)
  }

  const handleEditSuccess = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const [deleteId, setDeleteId] = useState<number | null>(null)

  const handleDeleteClick = (id: number) => {
    setDeleteId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteProduct(deleteId)
      setRefreshKey((prev) => prev + 1)
      setDeleteId(null)
      toast.success("Product deleted successfully.")
    } catch (err) {
      handleApiError(err)
    }
  }

  return (
    <>
      <div className="border border-[#e0e0e0] rounded-2xl p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">All Products</h2>
          <button
            onClick={() => navigate("/store/add")}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {isLoading && !items.length && (
          <p className="text-center text-gray-500 py-4">Loading products...</p>
        )}

        {error && (
          <p className="text-center text-red-500 py-4">{error}</p>
        )}

        {!isLoading && !error && !items.length && (
          <p className="text-center text-gray-500 py-4">
             You don't have any products yet.
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
                ? resolveImageUrl(product.image_url)
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
                      ฿{product.price}
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
                      onClick={() => handleDeleteClick(product.id)}
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
                      {isActive ? "Visible" : "Hidden"}
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
        <StoreEditProductModal
          isOpen={isEditOpen}
          onClose={handleCloseEdit}
          product={editProduct}
          onSuccess={handleEditSuccess}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Product Deletion"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete Product"
        variant="danger"
      />
    </>
  )
}
