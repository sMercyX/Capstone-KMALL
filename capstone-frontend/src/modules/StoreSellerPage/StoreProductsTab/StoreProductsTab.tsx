import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Pencil, Trash2, Plus, ChevronDown, Loader2 } from "lucide-react"
import { FiSearch } from "react-icons/fi"
import Pagination from "../../../components/Pagination/Pagination"
import { useProductApi } from "../../../api/productApi"
import { type storeProductDataRequset } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import { useStoreProductStore } from "./storeProductStore"
import StoreEditProductModal from "./StoreEditProductModal"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"
import { handleApiError } from "../../../utils/handleApiError"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import { useClickOutside } from "../../../hooks/useClickOutside"

interface CategoryDropdownProps {
  label: string
  options: CatagoriesResponse[]
  value: number | "ALL"
  onChange: (val: number | "ALL") => void
  disabled?: boolean
  icon?: React.ReactNode
}

function CategoryDropdown({ label, options, value, onChange, disabled, icon }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, () => setIsOpen(false))

  const selectedOption = options.find(opt => opt.id === value)
  const displayLabel = value === "ALL" ? label : selectedOption?.name || label

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-[220px] px-4 py-3 rounded-xl border bg-white shadow-sm transition-all duration-300 text-sm font-medium cursor-pointer ${
          disabled 
            ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400" 
            : "border-gray-100 text-gray-700 hover:border-[#ff5a36]/40 hover:shadow-md hover:shadow-orange-100/20"
        } ${isOpen ? "border-[#ff5a36] ring-4 ring-orange-50/50 shadow-md shadow-orange-100/30" : ""}`}
      >
        <div className="flex items-center gap-3 truncate">
          {icon && <span className={`${isOpen ? "text-[#ff5a36]" : "text-gray-400"} transition-colors duration-300`}>{icon}</span>}
          <span className={`truncate ${value !== "ALL" ? "text-gray-900 font-bold" : ""}`}>{displayLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#ff5a36]" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[260px] bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 origin-top">
          <div className="max-h-[320px] overflow-y-auto pr-1 mr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <button
              onClick={() => {
                onChange("ALL")
                setIsOpen(false)
              }}
              className={`flex items-center justify-between w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50/50 mb-1 hover:bg-orange-50/40 ${
                value === "ALL" ? "text-[#ff5a36] font-bold bg-orange-50/30" : "text-gray-600"
              }`}
            >
              <span>All {label}</span>
              {value === "ALL" && <div className="w-1.5 h-1.5 rounded-full bg-[#ff5a36]" />}
            </button>
            <div className="px-1.5 space-y-0.5">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                  }}
                  className={`flex items-center justify-between w-full text-left px-3 py-2.5 text-sm transition-all rounded-lg hover:bg-orange-50/40 group ${
                    value === opt.id ? "text-[#ff5a36] font-bold bg-orange-50/30 shadow-sm shadow-orange-100/10" : "text-gray-600"
                  }`}
                >
                  <span className="truncate group-hover:translate-x-0.5 transition-transform duration-200">{opt.name}</span>
                  {value === opt.id && (
                    <div className="flex items-center">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#ff5a36]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {options.length === 0 && (
               <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                  No sub categories found
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function StoreProductsTab() {
  const { getCatagoriesName } = useCatagoriesApi()
  const { deleteProduct, searchProducts } = useProductApi()
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
  const [editProduct, setEditProduct] = useState<storeProductDataRequset | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchQueryDebounced, setSearchQueryDebounced] = useState("")
  
  const [mainCategories, setMainCategories] = useState<CatagoriesResponse[]>([])
  const [subCategories, setSubCategories] = useState<CatagoriesResponse[]>([])
  const [selectedMainCategory, setSelectedMainCategory] = useState<number | "ALL">("ALL")
  const [selectedSubCategory, setSelectedSubCategory] = useState<number | "ALL">("ALL")
  
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Load Main Categories
  useEffect(() => {
    const loadMainCats = async () => {
      try {
        const res = await getCatagoriesName(0) // Assuming 0 is top-level
        setMainCategories(res.data || [])
      } catch (err) {
        console.error("Failed to load main categories:", err)
      }
    }
    loadMainCats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load Sub Categories when Main Category changes
  useEffect(() => {
    if (selectedMainCategory === "ALL") {
      setSubCategories([])
      setSelectedSubCategory("ALL")
      return
    }

    const loadSubCats = async () => {
      try {
        const res = await getCatagoriesName(Number(selectedMainCategory))
        setSubCategories(res.data || [])
        setSelectedSubCategory("ALL")
      } catch (err) {
        console.error("Failed to load sub categories:", err)
      }
    }
    loadSubCats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMainCategory])

  // เปลี่ยนร้าน → รีเซ็ต pagination
  useEffect(() => {
    if (!store?.id) return
    reset()
    setPageIndex(1)
  }, [store?.id, reset, setPageIndex])

  // โหลดสินค้าของร้าน (มี pagination + search + filter)
  useEffect(() => {
    if (!store?.id) return

    let cancelled = false

    async function load() {
      try {
        startLoading()
        const res = await searchProducts({
          storeId: store?.id,
          q: searchQueryDebounced,
          parentCategoryId: selectedMainCategory === "ALL" ? undefined : Number(selectedMainCategory),
          categoryIds: selectedSubCategory === "ALL" ? undefined : [Number(selectedSubCategory)],
          page: pageIndex,
          limit: pageSize
        })
        
        if (!cancelled) {
          setPageData(res.data as any)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, pageIndex, pageSize, refreshKey, searchQueryDebounced, selectedMainCategory, selectedSubCategory])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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
    <div className="p-0">
      {/* Breadcrumb & Title */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-2">
          Products &gt; <span className="font-semibold text-gray-600">Product Management</span>
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Management</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Manage your products including adding, editing, updating stock, and organizing product information.
        </p>
      </div>

      {/* Search, Filter, Add button */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="relative flex-1 min-w-[300px]">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 bg-white shadow-sm focus:outline-none focus:border-[#ff5a36] transition-all"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value
              setSearchQuery(val)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => {
                setSearchQueryDebounced(val)
              }, 400)
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <CategoryDropdown
            label="Main Category"
            options={mainCategories}
            value={selectedMainCategory}
            onChange={setSelectedMainCategory}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />

          <CategoryDropdown
            label="Sub Category"
            options={subCategories}
            value={selectedSubCategory}
            onChange={setSelectedSubCategory}
            disabled={selectedMainCategory === "ALL"}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 5L10 12L15 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 9L18 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
            }
          />
        </div>

        <button
          onClick={() => navigate("/store/add")}
          className="flex items-center gap-2 px-6 py-3 bg-[#ff5a36] text-white rounded-xl text-sm font-bold hover:bg-[#e04e2d] transition-all shadow-lg shadow-orange-200 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Products</h2>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto min-h-[400px]">
        <div className="min-w-[1100px] mb-4">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 bg-white border border-gray-100 rounded-t-xl px-6 py-4 text-[11px] uppercase tracking-wider font-bold text-gray-400 border-b-2">
            <div className="col-span-4">Product Name</div>
            <div className="col-span-3">Product Description</div>
            <div className="col-span-1">Quantity</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Price</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* List of Products */}
          <div className="space-y-3 mt-3">
            {isLoading && !items.length ? (
              <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                <Loader2 className="w-8 h-8 animate-spin text-[#ff5a36]" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-red-100 text-red-500">
                <p>{error}</p>
                <button onClick={() => setRefreshKey(k => k + 1)} className="mt-4 text-sm font-bold text-[#ff5a36] hover:underline">Try again</button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 text-gray-400">
                <p>No products found.</p>
              </div>
            ) : (
              items.map((product) => {
                const isActive = product.is_active === "YES"
                return (
                  <div
                    key={product.id}
                    className="grid grid-cols-12 gap-4 items-center bg-white border border-gray-100 rounded-xl px-6 py-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:shadow-md hover:border-[#ff5a36]/30 group"
                  >
                    {/* Product Name & Image */}
                    <div className="col-span-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                        <img
                          src={product.image_url ? resolveImageUrl(product.image_url) : "/images/default-store.png"}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-bold text-gray-800 text-sm truncate" title={product.name}>
                        {product.name}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="col-span-3 text-xs text-gray-500 truncate" title={product.description}>
                      {product.description || "—"}
                    </div>

                    {/* Quantity - Mocked */}
                    <div className="col-span-1 text-sm text-gray-700 font-semibold pl-4">
                      1
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 ${isActive ? "text-green-500" : "text-gray-400"}`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-gray-300"}`}></div>
                         {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="col-span-1 text-right font-bold text-gray-900">
                      {product.price} ฿
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-[#ff5a36] hover:border-[#ff5a36]/20 hover:shadow-sm transition-all cursor-pointer"
                        title="Edit Product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:shadow-sm transition-all cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-10">
           <Pagination
            currentPage={pageIndex}
            totalPages={totalPages}
            onPageChange={setPageIndex}
          />
        </div>
      )}

      {/* Modals */}
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
    </div>
  )
}
