import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Trash2,
} from "lucide-react"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"

import { handleApiError } from "../../../utils/handleApiError"
import { useProductApi, type AddProductRequest, type productPictureResponse, type EditProductRequest, type EditVariantsConfigReq, type OptionKey, type OptionValue, type Variant } from "../../../api/productApi"
import { useStoreStore } from "../../../stores/storeStore"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../utils/imageProcessing"
import { Dropdown } from "../../../components/Dropdown"
import ToggleSwitch from "../../../components/Toggle/ToggleSwitch"
import { Input } from "../../../components/Input/Input"
import { InputNumber } from "../../../components/Input/InputNumber"
import { Textarea } from "../../../components/Input/Textarea"
import { ImageUpload } from "../../../components/Upload/ImageUpload"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"
import { OptionCard, type LocalOption } from "./OptionCard"

// (LocalVariant and ImageItem remain here as they are local to this tab's state logic)
export interface LocalVariant {
  id: string;
  option_value_labels: string[];
  price_delta: number;
  stock_qty: number;
  is_active: boolean;
}

type ImageItem = {
  id?: number; // for existing images
  url: string;
  file?: File; // for new images
}

export function StoreAddEditTab() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id

  const [images, setImages] = useState<ImageItem[]>([])
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([])
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "warning",
  })
  const [deletedOptionValueImageIds, setDeletedOptionValueImageIds] = useState<{ keyId: number; valueId: number }[]>([])
  const [mainIndex, setMainIndex] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState<string>("")
  const [productType, setProductType] = useState("PREORDER")
  const [isActive, setIsActive] = useState(true)
  
  // Category states
  const [mainCategoryId, setMainCategoryId] = useState<number | "ALL">("ALL")
  const [subCategoryId, setSubCategoryId] = useState<number | "ALL">("ALL")
  const [mainCategories, setMainCategories] = useState<CatagoriesResponse[]>([])
  const [subCategories, setSubCategories] = useState<CatagoriesResponse[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  
  // Options & Variants state
  const [options, setOptions] = useState<LocalOption[]>([])
  const [variants, setVariants] = useState<LocalVariant[]>([])
  const [bulkDeltaPrice, setBulkDeltaPrice] = useState<string>("")
  const [bulkStock, setBulkStock] = useState<string>("")

  // Validation state
  const [errors, setErrors] = useState<{ name?: boolean; price?: boolean; category?: boolean; description?: boolean; images?: boolean }>({})
  const [formError, setFormError] = useState<string | null>(null)
  
  const steps = [
    { id: "product-info", label: "Product Information" },
    { id: "product-options", label: "Options" },
    { id: "product-variants", label: "Variants" },
  ]

  const filteredSteps = steps.filter(step => {
    if (productType === "PREORDER") {
      return step.id === "product-info"
    }
    return true
  })

  // ScrollSpy state
  const [activeTab, setActiveTab] = useState("product-info")
  const isScrolling = useRef(false)

  const { addProduct, editProduct, editProductVariantsConfig, getProductById, bulkUploadProductImages, editImageProduct, getProductImage, deleteProductImage, deleteOptionValueImage } = useProductApi()
  const { store } = useStoreStore()
  const { getCatagoriesName, getCatagoriesDetail } = useCatagoriesApi()
  const isProgrammaticChange = useRef(false)

  // ---------- Fetch Product Data (Edit Mode) ----------
  useEffect(() => {
    if (!isEditMode || !id) return

    const fetchProduct = async () => {
      try {
        const productId = Number(id)
        
        // 1. Get Product Details
        const res = await getProductById(productId)
        const p = res.data
        if (!p) return

        setName(p.name)
        setDescription(p.description)
        setPrice(String(p.price))
        setProductType(p.product_type)
        setIsActive(p.is_active === "YES")
        
        // Fetch category detail to get parent_id
        try {
          isProgrammaticChange.current = true
          const catRes = await getCatagoriesDetail(p.category_id)
          if (catRes.data.parent_id) {
            setMainCategoryId(catRes.data.parent_id)
          } else {
            setMainCategoryId(p.category_id)
          }
          setSubCategoryId(p.category_id)
          
          // Reset after a short delay to ensure useEffects have read it
          setTimeout(() => {
            isProgrammaticChange.current = false
          }, 500)
        } catch (catErr) {
          console.error("Failed to fetch category detail:", catErr)
          // Fallback to previous logic if needed, or just set sub
          setSubCategoryId(p.category_id)
        }

        // 2. Options & Variants
        if (p.options && p.options.length > 0) {
          setOptions(p.options.map((opt: OptionKey) => ({
            id: String(opt.id),
            name: opt.key_name,
            is_image_key: opt.is_image_key || false,
            values: opt.values.map((v: OptionValue) => v.value_label),
            value_images: opt.values.reduce((acc: any, v: OptionValue) => {
              acc[v.value_label] = { 
                url: v.image_url || undefined,
                valueId: v.id 
              }
              return acc
            }, {})
          })))
        }

        if (p.variants && p.variants.length > 0) {
          setVariants(p.variants.map((v: Variant) => ({
            id: v.selections.map((s: { value: string }) => s.value).join(" / "),
            option_value_labels: v.selections.map((s: { value: string }) => s.value),
            price_delta: v.price_delta,
            stock_qty: v.stock_qty,
            is_active: v.is_active
          })))
        }

        // 3. Images
        const imgRes = await getProductImage(productId)
        const apiImages = imgRes.data || []
        setImages(apiImages.map((img: productPictureResponse) => ({
          id: img.id,
          url: img.image_url
        })))
        
        const primaryIdx = apiImages.findIndex((img: productPictureResponse) => img.is_primary)
        if (primaryIdx >= 0) setMainIndex(primaryIdx)

      } catch (err) {
        handleApiError(err)
      }
    }

    fetchProduct()
  }, [isEditMode, id])

  // ---------- scroll spy ----------
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (isScrolling.current) return
      
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveTab(entry.target.id)
        }
      })
    }, {
      root: contentRef.current,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    })

    filteredSteps.forEach(step => {
      const el = document.getElementById(step.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (tabId: string) => {
    setActiveTab(tabId)
    isScrolling.current = true
    const element = document.getElementById(tabId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setTimeout(() => {
      isScrolling.current = false
    }, 800)
  }

  // ---------- load main categories ----------
  useEffect(() => {
    const loadMainCategories = async () => {
      setLoadingCategories(true)
      try {
        const res = await getCatagoriesName(0)
        setMainCategories(res.data || [])
      } catch (err) {
        console.error("Failed to load main categories:", err)
        setCategoryError("Failed to load categories")
      } finally {
        setLoadingCategories(false)
      }
    }
    loadMainCategories()
  }, [])

  // ---------- load sub categories ----------
  useEffect(() => {
    if (mainCategoryId === "ALL") {
      setSubCategories([])
      setSubCategoryId("ALL")
      return
    }

    const loadSubCategories = async () => {
      try {
        const res = await getCatagoriesName(mainCategoryId as number)
        setSubCategories(res.data || [])
        
        // Only reset sub-category if this was a manual change by the user
        if (!isProgrammaticChange.current) {
          setSubCategoryId("ALL")
        }
      } catch (err) {
        console.error("Failed to load sub categories:", err)
      }
    }
    loadSubCategories()
  }, [mainCategoryId])

  // ---------- image handlers ----------

  async function handleFilesChange(selectedFiles: File[]) {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newItems: ImageItem[] = []

    for (const file of Array.from(selectedFiles)) {
       try {
          const processedFile = await processImageFile(file)
           if (processedFile.size > 2 * 1024 * 1024) {
             toast.error(`File ${file.name} exceeds 2MB after processing.`)
             continue
           }
           newItems.push({
             url: URL.createObjectURL(processedFile),
             file: processedFile
           })
       } catch (err) {
           console.error("File processing failed:", err)
       }
    }

    setImages((prev) => {
      const next = [...prev, ...newItems]
      return next
    })
  }

  const handleSelectMain = (index: number) => {
    if (index === mainIndex) return
    
    setConfirmModal({
      isOpen: true,
      title: "Change Main Image",
      message: "Set this image as the main image?",
      variant: "warning",
      onConfirm: () => {
        setImages((prev) => {
          const item = prev[index]
          const remaining = prev.filter((_, i) => i !== index)
          const next = [item, ...remaining]
          return next
        })
        setMainIndex(0)
      },
    })
  }

  const handleDeleteImage = (index: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Image",
      message: "Are you sure you want to delete this image?",
      variant: "danger",
      onConfirm: () => {
        const target = images[index]
        if (target?.id) {
           setDeletedImageIds(prev => [...prev, target.id!])
        }

        setImages((prev) => {
          const next = prev.filter((_, i) => i !== index)
          if (next.length === 0) { setMainIndex(0); return next; }
          if (index === mainIndex) { setMainIndex(0); return next; } 
          else if (index < mainIndex) { setMainIndex((prevMain) => prevMain - 1); }
          return next
        })
      },
    })
  }

  // ---------- options & variants handlers ----------
  const handleAddOption = () => {
    if (options.length < 3) {
      setOptions([...options, { 
        id: `opt_${Date.now()}`, 
        name: "", 
        values: [],
        is_image_key: false,
        value_images: {}
      }])
    }
  }

  const handleUpdateOption = (idx: number, opt: LocalOption) => {
    setOptions(prev => {
      let nextOptions = [...prev]
      
      // Rule: only one option can have is_image_key = true
      if (opt.is_image_key && !prev[idx].is_image_key) {
        nextOptions = nextOptions.map((o, i) => ({
          ...o,
          is_image_key: i === idx
        }))
      } else {
        nextOptions[idx] = opt
      }
      
      return nextOptions
    })
  }

  const handleRemoveOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    setVariants((prevVariants) => {
      const validOptions = options.filter(opt => opt.name.trim() !== "" && opt.values.length > 0)
      
      if (validOptions.length === 0) {
        return prevVariants.length === 0 ? prevVariants : []
      }

      const cartesianProduct = (arrays: string[][]): string[][] => {
        return arrays.reduce<string[][]>(
          (acc, curr) => acc.flatMap(c => curr.map(n => [...c, n])),
          [[]]
        )
      }

      const valueArrays = validOptions.map(opt => opt.values)
      const combinations = cartesianProduct(valueArrays)
      
      const newVariants = combinations.map(combo => {
        const id = combo.join(" / ")
        const existing = prevVariants.find(v => v.id === id)
        return {
          id,
          option_value_labels: combo,
          price_delta: existing?.price_delta ?? 0,
          stock_qty: existing?.stock_qty ?? 0,
          is_active: existing?.is_active ?? true
        }
      })

      // Compare to prevent infinite loop
      if (prevVariants.length === newVariants.length && prevVariants.every((v, i) => v.id === newVariants[i].id)) {
        return prevVariants
      }

      return newVariants
    })
  }, [options])

  // ---------- submit product ----------
  const handleSave = async () => {
    setFormError(null)
    setErrors({})

    if (!store?.id) {
      setFormError("Store not found. Please refresh the page.")
      return
    }

    const newErrors: { name?: boolean; price?: boolean; category?: boolean; description?: boolean; images?: boolean } = {}
    let hasError = false

    if (!name.trim()) { newErrors.name = true; hasError = true; }
    if (!description.trim()) { newErrors.description = true; hasError = true; }
    const priceNumber = Number(price)
    if (Number.isNaN(priceNumber) || priceNumber <= 0) { newErrors.price = true; hasError = true; }
    if (subCategoryId === "ALL") { newErrors.category = true; hasError = true; }
    if (images.length === 0) { newErrors.images = true; hasError = true; }

    if (hasError) {
      setErrors(newErrors)
      toast.error("Please fill in all required fields.")
      return
    }

    try {
      setIsSubmitting(true)
      const productId = isEditMode ? Number(id) : null

      if (isEditMode && productId) {
      

        const editPayload: EditProductRequest = {
          name,
          description,
          price: priceNumber,
          is_active: isActive ? "YES" : "NO",
          category_id: subCategoryId as number,
        }

        await editProduct(productId, editPayload)


          // Handle Image Deletions
        for (const imageId of deletedImageIds) {
          await deleteProductImage(imageId)
        }

        // Handle Option Value Image Deletions
        for (const del of deletedOptionValueImageIds) {
            try {
                await deleteOptionValueImage(productId, del.keyId, del.valueId)
            } catch (err) {
                console.error("Failed to delete option value image:", err)
            }
        }
        
        if (productType !== "PREORDER") {
          const variantsConfigPayload: EditVariantsConfigReq = {
            options: options.map((opt, i) => ({
              key_name: opt.name,
              sort_order: i + 1,
              values: opt.values,
              is_image_key: opt.is_image_key
            })),
            variants: variants.map(v => ({
              option_value_labels: v.option_value_labels,
              price_delta: v.price_delta,
              stock_qty: v.stock_qty,
              is_active: v.is_active
            }))
          }
          await editProductVariantsConfig(productId, variantsConfigPayload)
        }

        // Handle New Image Uploads (Product + Options)
        const productFiles = images.filter(img => img.file).map(img => img.file!)
        const optionValueFiles: { optionName: string; valueLabel: string; file: File }[] = []
        
        options.forEach(opt => {
          if (opt.is_image_key) {
            Object.entries(opt.value_images).forEach(([label, data]) => {
              if (data.file) {
                optionValueFiles.push({
                  optionName: opt.name,
                  valueLabel: label,
                  file: data.file
                })
              }
            })
          }
        })

        if (productFiles.length > 0 || optionValueFiles.length > 0) {
          try {
            const resImages = await bulkUploadProductImages(productId, productFiles, optionValueFiles)
            const uploadedImages = resImages.data.product_images || []
            
            // If the main image was a NEW upload, set it as primary now
            const intendedMain = images[mainIndex]
            if (intendedMain?.file) {
              const fileIndex = productFiles.findIndex(f => f === intendedMain.file)
              if (fileIndex !== -1 && uploadedImages[fileIndex]) {
                await editImageProduct(uploadedImages[fileIndex].id, { is_primary: true })
              }
            }
          } catch (uploadErr) {
            console.error("Bulk image upload failed:", uploadErr)
            handleApiError(uploadErr)
          }
        }

        // Update Primary Image if changed
        try {
          const intendedMain = images[mainIndex]
          if (intendedMain?.id) {
            // Case 1: Main image already existed
            await editImageProduct(intendedMain.id, { is_primary: true })
          }
        } catch (imgErr) {
          console.error("Failed to update existing primary image:", imgErr)
        }

        toast.success("Product updated successfully!")
        navigate("/store/products")

      } else {
        // ---------- ADD MODE ----------
        const payload: AddProductRequest = {
          name,
          description,
          price: priceNumber,
          product_type: productType,
          image_url: "", 
          is_active: "YES",
          store_id: store.id,
          category_id: subCategoryId as number,
        }

        if (productType !== "PREORDER") {
          payload.options = options.map((opt, i) => ({
            key_name: opt.name,
            sort_order: i + 1,
            is_image_key: opt.is_image_key,
            values: opt.values.map((val, j) => ({ 
              value_label: val, 
              sort_order: j + 1 
            }))
          }))
          payload.variants = variants.map(v => ({
            option_value_labels: v.option_value_labels,
            price_delta: v.price_delta,
            stock_qty: v.stock_qty,
            is_active: v.is_active
          }))
        }

        const res = await addProduct(payload)
        const newProductId = res.data.id

        // Handle New Image Uploads (Product + Options)
        const productFiles = images.filter(img => img.file).map(img => img.file!)
        const optionValueFiles: { optionName: string; valueLabel: string; file: File }[] = []
        
        options.forEach(opt => {
          if (opt.is_image_key) {
            Object.entries(opt.value_images).forEach(([label, data]) => {
              if (data.file) {
                optionValueFiles.push({
                  optionName: opt.name,
                  valueLabel: label,
                  file: data.file
                })
              }
            })
          }
        })

        if (productFiles.length > 0 || optionValueFiles.length > 0) {
          try {
            const resImages = await bulkUploadProductImages(newProductId, productFiles, optionValueFiles)
            const uploadedImages = resImages.data.product_images || []

            // Reordered logic: the first one in productFiles is the main one if images[0].file exists
            const intendedMain = images[mainIndex]
            if (intendedMain?.file) {
              const fileIndex = productFiles.findIndex(f => f === intendedMain.file)
              if (fileIndex !== -1 && uploadedImages[fileIndex]) {
                await editImageProduct(uploadedImages[fileIndex].id, { is_primary: true })
              }
            }
          } catch (uploadErr) {
            console.error("Bulk image upload failed:", uploadErr)
            handleApiError(uploadErr)
          }
        }

        toast.success("Product published successfully!")
        navigate("/store/products")
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setIsSubmitting(false)
    }
  }
  const productTypeOptions = [
    { id: "STOCK", name: "Stock" },
    { id: "PREORDER", name: "Pre-order" }
  ]

  return (
    <>
      <div className="mx-auto flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      {/* Breadcrumbs & Title */}
      <div className="mb-6 flex-shrink-0 text-left">
        <p className="text-description text-gray-400 mb-1">
          Store &gt;{" "}
          <span 
            className="hover:text-[#ff5a36] cursor-pointer transition-colors"
            onClick={() => navigate("/store/products")}
          >
            Product Management
          </span>{" "}
          &gt; <span className="font-semibold text-gray-600">{isEditMode ? "Edit Product" : "Add Product"}</span>
        </p>
        <h1 className="text-header font-bold text-gray-900">{isEditMode ? "Edit Product" : "Add Product"}</h1>
        <p className="text-description text-gray-500">
          {isEditMode 
            ? "Update your product details, pricing, and stock information." 
            : "Create a new product by adding details, pricing, and stock information."}
        </p>
      </div>

      {/* Stepper (Navigation Tabs) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 px-4 flex-shrink-0">
        <div className="flex gap-4 sm:gap-10 overflow-x-auto scrollbar-hide">
          {filteredSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => scrollToSection(step.id)}
              className={`py-4 px-1 font-bold text-sm relative transition-all whitespace-nowrap ${
                activeTab === step.id
                  ? "text-[#ff5a36]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {step.label}
              {activeTab === step.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#ff5a36] rounded-t-lg animate-in fade-in slide-in-from-bottom-1 duration-300" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto bg-transparent border-0 space-y-6 pb-20 pr-2 scroll-smooth">
          <div id="product-info" className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible p-6 md:p-10">
            <div className="flex justify-between items-center pb-4 border-b border-gray-50">
              <h2 className="text-header font-bold text-gray-900">Product Information</h2>
              {isEditMode && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">Display Product</span>
                  <ToggleSwitch checked={isActive} onChange={setIsActive} />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="md:col-span-2">
                <Input
                  label="Product Name"
                  placeholder="e.g. Oversize T-Shirt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                  required
                />
              </div>

              <div>
                <InputNumber
                  label="Base Price (฿)"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  error={errors.price}
                  required
                />
              </div>

              {/* Product Type */}
              <div>
                <label className="block text-text font-semibold mb-1 text-gray-800">Product Type <span className="text-red-500">*</span></label>
                {isEditMode ? (
                  <div className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-gray-50/50 text-gray-500 flex items-center">
                    {productType === "PREORDER" ? "Pre-order" : "Stock"}
                  </div>
                ) : (
                  <Dropdown
                    label="Product Type"
                    options={productTypeOptions as any}
                    value={productType}
                    onChange={(val) => setProductType(val as string)}
                    allLabel={null}
                    className="w-full"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Description"
                  placeholder="Describe your product..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  error={errors.description}
                  required
                  className="min-h-[160px]"
                />
              </div>

              {/* Category Selectors */}
              <div className="md:col-span-1">
                <label className="block text-text font-semibold mb-1 text-gray-800">
                  Main Category {loadingCategories && <span className="text-xs font-normal text-gray-400 ml-1">(Loading...)</span>} <span className="text-red-500">*</span>
                </label>
                <Dropdown
                  label="Main Category"
                  placeholder="Select Main Category"
                  options={mainCategories}
                  value={mainCategoryId}
                  onChange={setMainCategoryId}
                  className="w-full"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-text font-semibold mb-1 text-gray-800">Sub Category <span className="text-red-500">*</span></label>
                <Dropdown
                  label="Sub Category"
                  placeholder="Select Sub Category"
                  options={subCategories}
                  value={subCategoryId}
                  onChange={setSubCategoryId}
                  disabled={mainCategoryId === "ALL"}
                  className="w-full"
                />
              </div>

              <ImageUpload
                label="Product Images"
                onFilesChange={handleFilesChange}
                multiple
                accept={SUPPORTED_IMAGE_TYPES}
                error={!!errors.images}
                className="md:col-span-2 mt-4"
                hint="Click to select files (JPG, PNG, WebP, HEIC or HEIF up to 2MB)"
              />

                {images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-5">
                      {images.map((img, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSelectMain(idx)}
                          className={`relative w-40 h-50 md:w-48 md:h-56 rounded-2xl border-2 overflow-hidden group shadow-md transition-all cursor-pointer ${mainIndex === idx ? "border-[#ff5a36] ring-2 ring-orange-100" : "border-gray-100 hover:border-orange-200"}`}
                        >
                           <img src={resolveImageUrl(img.url)} className="w-full h-full object-cover" />
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                             className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-red-500 hover:bg-red-50/90 transition-all z-10"
                             title="Delete Image"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                           {mainIndex === idx && (
                             <div className="absolute bottom-0 left-0 right-0 bg-[#ff5a36] text-white text-[10px] font-bold py-1 text-center uppercase tracking-wider">Main</div>
                           )}
                           {mainIndex !== idx && (
                             <div className="absolute inset-0 bg-black/40 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                               Set Main
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                )}
                {formError && <p className="mt-6 text-sm text-red-500 text-center">{formError}</p>}
                {categoryError && <p className="mt-2 text-xs text-red-500 text-center">{categoryError}</p>}
              </div>
          </div>
          {productType !== "PREORDER" && (
            <>
              <div id="product-options" className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible p-6 md:p-10 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-50 mb-6">
                  <h2 className="text-header font-bold text-gray-900">Product Options</h2>
                </div>
                
                <div className="space-y-6">
                  {options.map((opt, i) => (
                    <OptionCard 
                      key={opt.id}
                      option={opt} 
                      index={i} 
                      updateOption={handleUpdateOption}
                      removeOption={handleRemoveOption}
                      productId={isEditMode ? Number(id) : undefined}
                      onDeleteValueImage={(keyId, valueId) => {
                        setDeletedOptionValueImageIds(prev => [...prev, { keyId, valueId }])
                      }}
                    />
                  ))}
                  {options.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                      No options added.
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleAddOption}
                  disabled={options.length >= 3}
                  className="w-full py-4 mt-6 border-2 cursor-pointer border-dashed border-[#ff5a36] text-[#ff5a36] rounded-xl font-bold hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Option (max 3 options)
                </button>
              </div>

              <div id="product-variants" className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible p-6 md:p-10">
                <div className="flex justify-between items-center pb-4 border-b border-gray-50 mb-6">
                  <h2 className="text-header font-bold text-gray-900">Product Variants</h2>
                </div>

                {variants.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                    Add options to generate variants.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bulk Delta Price (฿)</label>
                        <InputNumber 
                          placeholder="+0 or -50"
                          value={bulkDeltaPrice}
                          allowNegative={true}
                          onChange={(e) => {
                            const val = e.target.value
                            setBulkDeltaPrice(val)
                            const num = Number(val)
                            setVariants(prev => prev.map(v => ({ ...v, price_delta: isNaN(num) ? 0 : num })))
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bulk Stock Qty</label>
                        <InputNumber 
                          placeholder="e.g. 100"
                          value={bulkStock}
                          onChange={(e) => {
                            const val = e.target.value
                            setBulkStock(val)
                            const num = Number(val)
                            setVariants(prev => prev.map(v => ({ ...v, stock_qty: isNaN(num) ? 0 : num })))
                          }}
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Configuration</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Delta Price</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50 border-l border-gray-100 text-center">Total Price</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Active</th>

                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {variants.map((v, i) => (
                            <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {v.option_value_labels.map((lbl, lIdx) => (
                                    <span key={lIdx} className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 text-xs font-semibold">
                                      {lbl}
                                    </span>
                                  ))}
                                </div>
                              </td>
                             
                              <td className="px-6 py-4">
                                <InputNumber 
                                  value={v.price_delta}
                                  allowNegative={true}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value)
                                    const newV = [...variants]
                                    newV[i].price_delta = val as number
                                    setVariants(newV)
                                  }}
                                  className="w-24"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <InputNumber 
                                  value={v.stock_qty}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value)
                                    const newV = [...variants]
                                    newV[i].stock_qty = (val as number) >= 0 || val === "" ? (val as number) : 0
                                    setVariants(newV)
                                  }}
                                  className="w-24"
                                />
                                
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900 text-center border-l border-gray-100 bg-gray-50/50">
                                {(Number(price) || 0) + (v.price_delta || 0)} ฿
                              </td>
                               <td className="px-6 py-4 text-center">
                                <div className="flex justify-center scale-90">
                                  <ToggleSwitch 
                                    checked={v.is_active} 
                                    onChange={(checked) => {
                                      const newV = [...variants]
                                      newV[i].is_active = checked
                                      setVariants(newV)
                                    }} 
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Toolbar Section */}
        <div className="shrink-0 bg-white border border-gray-200 rounded-lg mt-4 px-6 py-4 shadow-sm">
          <div className="flex justify-end gap-4">
            <button 
              onClick={() => navigate("/store/products")}
              disabled={isSubmitting}
              className="px-8 py-2.5 cursor-pointer rounded-lg bg-[#8E8E93] text-white font-bold hover:bg-[#7A7A7F] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-10 py-2.5 cursor-pointer rounded-lg bg-[#ff5a36] text-white font-bold hover:bg-[#e04e2d] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-md shadow-orange-100"
            >
              {isSubmitting ? "Saving..." : isEditMode ? "Update Product" : "Confirm & Publish Product"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  )
}
