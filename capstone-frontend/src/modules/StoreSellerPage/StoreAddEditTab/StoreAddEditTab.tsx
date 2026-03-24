import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ImagePlus,
  Trash2,
  Upload,
  ImageIcon,
} from "lucide-react"
import { toast } from "react-toastify"

import { handleApiError } from "../../../utils/handleApiError"
import { useProductApi, type AddProductRequest, type productPictureResponse, type EditProductRequest, type EditVariantsConfigReq, type OptionKey, type OptionValue, type Variant } from "../../../api/productApi"
import { useStoreStore } from "../../../stores/storeStore"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../utils/imageProcessing"
import { Dropdown } from "../../../components/Dropdown"
import ToggleSwitch from "../../../components/Toggle/ToggleSwitch"

export interface LocalOption {
  id: string;
  name: string;
  values: string[];
  is_image_key: boolean;
  value_images: Record<string, { file?: File; url?: string; valueId?: number }>;
}

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


function OptionCard({ 
  option, 
  index, 
  updateOption, 
  removeOption,
  onDeleteValueImage
}: { 
  option: LocalOption; 
  index: number; 
  updateOption: (idx: number, opt: LocalOption) => void; 
  removeOption: (idx: number) => void;
  productId?: number;
  onDeleteValueImage?: (keyId: number, valueId: number) => void;
}) {
  const [inputValue, setInputValue] = useState("")

  const handleAddValue = () => {
    const val = inputValue.trim()
    if (val && !option.values.includes(val)) {
      updateOption(index, { ...option, values: [...option.values, val] })
      setInputValue("")
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white mb-6 relative shadow-sm">
      <button 
        onClick={() => removeOption(index)}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-gray-700">Product Option {index + 1}</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Use Image</span>
            <ToggleSwitch 
              checked={option.is_image_key} 
              onChange={() => updateOption(index, { ...option, is_image_key: !option.is_image_key })} 
            />
          </div>
        </div>
        <input 
          type="text" 
          value={option.name} 
          onChange={(e) => updateOption(index, { ...option, name: e.target.value })}
          placeholder="e.g. Color, Size" 
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#ff5a36] focus:ring-1 focus:ring-[#ff5a36] outline-none transition-all text-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Option Values</label>
        {option.values.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {option.values.map((val, vIdx) => (
              <div key={vIdx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-200 text-[#ff5a36] bg-orange-50 text-sm font-medium">
                <span>{val}</span>
                <button 
                  onClick={() => {
                    const newValues = option.values.filter((_, i) => i !== vIdx)
                    const newValueImages = { ...option.value_images }
                    delete newValueImages[val]
                    updateOption(index, { ...option, values: newValues, value_images: newValueImages })
                  }} 
                  className="hover:text-red-500 flex items-center justify-center"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-4">
          <input 
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(); } }}
            placeholder="e.g. the value red." 
            className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:border-[#ff5a36] focus:ring-1 focus:ring-[#ff5a36] outline-none transition-all text-gray-800"
          />
          <button onClick={handleAddValue} className="px-6 py-3 bg-[#ff5a36] text-white rounded-lg font-bold hover:bg-[#e04e2d] transition-all whitespace-nowrap">
            + Add
          </button>
        </div>

        {option.is_image_key && option.values.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {option.values.map((val, vIdx) => (
              <div key={vIdx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
                <div className="w-12 h-12 rounded bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {option.value_images[val]?.url ? (
                    <img src={option.value_images[val].url} alt={val} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700 truncate">{val}</p>
                  <p className="text-xs text-gray-400">
                    {option.value_images[val]?.file ? "File ready" : option.value_images[val]?.url ? "Uploaded" : "No image"}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = async (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const processedFile = await processImageFile(file);
                          const previewUrl = URL.createObjectURL(processedFile);
                          const newImages = { ...option.value_images };
                          newImages[val] = { file: processedFile, url: previewUrl };
                          updateOption(index, { ...option, value_images: newImages });
                        } catch (err) {
                          toast.error("Failed to process image")
                        }
                      }
                    };
                    input.click();
                  }}
                  className="p-2 text-[#ff5a36] hover:bg-orange-100 rounded-lg transition-all"
                >
                  <Upload className="w-5 h-5" />
                </button>
                {(option.value_images[val]?.file || option.value_images[val]?.url) && (
                  <button 
                    onClick={() => {
                      const imgData = option.value_images[val];
                      if (imgData?.valueId && onDeleteValueImage) {
                        onDeleteValueImage(Number(option.id ), imgData.valueId);
                      }
                      const newImages = { ...option.value_images };
                      newImages[val] = { ...newImages[val], file: undefined, url: undefined };
                      updateOption(index, { ...option, value_images: newImages });
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove Image"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={() => {}} className="px-6 py-2.5 border border-gray-200 bg-white rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-all">Done</button>
        <button onClick={() => removeOption(index)} className="px-6 py-2.5 border border-red-200 bg-white rounded-lg font-bold text-red-500 hover:bg-red-50 transition-all">Delete</button>
      </div>
    </div>
  )
}

export function StoreAddEditTab() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id

  const [images, setImages] = useState<ImageItem[]>([])
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([])
  const [deletedOptionValueImageIds, setDeletedOptionValueImageIds] = useState<{ keyId: number; valueId: number }[]>([])
  const [mainIndex, setMainIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
  const handleClickAddImages = () => {
    fileInputRef.current?.click()
  }

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files
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

    if (newItems.length === 0) {
      e.target.value = ""
      return
    }

    setImages((prev) => {
      const next = [...prev, ...newItems]
      if (prev.length === 0 && next.length > 0) {
        setMainIndex(0)
      }
      return next
    })

    e.target.value = ""
  }

  const handleDeleteImage = (index: number) => {
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
        // ---------- EDIT MODE ----------
        const editPayload: EditProductRequest = {
          name,
          description,
          price: priceNumber,
          is_active: isActive ? "YES" : "NO",
          category_id: subCategoryId as number,
        }

        await editProduct(productId, editPayload)

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
            await bulkUploadProductImages(productId, productFiles, optionValueFiles)
          } catch (uploadErr) {
            console.error("Bulk image upload failed:", uploadErr)
            // Use handleApiError to show the specific error from backend, but don't re-throw
            handleApiError(uploadErr)
          }
        }

        // Update Primary Image if changed
        try {
          const freshImgsRes = await getProductImage(productId)
          const freshImgs = freshImgsRes.data || []
          if (freshImgs[mainIndex]) {
            await editImageProduct(freshImgs[mainIndex].id, { is_primary: true })
          }
        } catch (imgErr) {
          console.error("Failed to update primary image:", imgErr)
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

            if (uploadedImages[mainIndex]) {
              await editImageProduct(uploadedImages[mainIndex].id, { is_primary: true })
            }
          } catch (uploadErr) {
            console.error("Bulk image upload failed:", uploadErr)
            // Use handleApiError to show the specific error from backend, but don't re-throw
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
    <div className="mx-auto flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      {/* Breadcrumbs & Title */}
      <div className="mb-6 flex-shrink-0 text-left">
        <p className="text-sm text-gray-400 mb-1.5">
          Products &gt;{" "}
          <span 
            className="hover:text-[#ff5a36] cursor-pointer transition-colors"
            onClick={() => navigate("/store/products")}
          >
            Product Management
          </span>{" "}
          &gt; <span className="font-semibold text-gray-600">{isEditMode ? "Edit Product" : "Add Product"}</span>
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{isEditMode ? "Edit Product" : "Add Product"}</h1>
        <p className="text-sm text-gray-500">
          {isEditMode 
            ? "Update your product details, pricing, and stock information." 
            : "Create a new product by adding details, pricing, and stock information."}
        </p>
      </div>

      {/* Stepper (Navigation Tabs) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 px-4 flex-shrink-0">
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
          <div id="product-info" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 md:p-10">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-50">
              <h2 className="text-2xl font-bold text-gray-900">Product Information</h2>
              {isEditMode && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-700">Display Product</span>
                  <ToggleSwitch checked={isActive} onChange={setIsActive} />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Oversize T-Shirt"
                  className={`w-full px-5 py-4 rounded-xl border focus:outline-none focus:ring-4 transition-all text-gray-800 placeholder:text-gray-300 ${
                    errors.name ? "border-red-500 bg-red-50/10 focus:ring-red-50" : "border-gray-100 bg-gray-50/30 focus:bg-white focus:border-[#ff5a36] focus:ring-orange-50/50"
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Base Price */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Base Price (฿) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  placeholder="0"
                  className={`w-full px-5 py-4 rounded-xl border focus:outline-none focus:ring-4 transition-all text-gray-800 placeholder:text-gray-300 ${
                    errors.price ? "border-red-500 bg-red-50/10 focus:ring-red-50" : "border-gray-100 bg-gray-50/30 focus:bg-white focus:border-[#ff5a36] focus:ring-orange-50/50"
                  }`}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              {/* Product Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Type <span className="text-red-500">*</span></label>
                {isEditMode ? (
                  <div className="w-full px-5 py-4 rounded-xl border border-gray-100 bg-gray-50/50 text-gray-500 font-medium h-[60px] flex items-center">
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

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Description <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="Describe your product..."
                  className={`w-full px-5 py-4 rounded-xl border focus:outline-none focus:ring-4 transition-all text-gray-800 min-h-[160px] resize-none placeholder:text-gray-300 ${
                    errors.description ? "border-red-500 bg-red-50/10 focus:ring-red-50" : "border-gray-100 bg-gray-50/30 focus:bg-white focus:border-[#ff5a36] focus:ring-orange-50/50"
                  }`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Category Selectors */}
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
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
                <label className="block text-sm font-bold text-gray-700 mb-2">Sub Category <span className="text-red-500">*</span></label>
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

              {/* Image Upload */}
              <div className="md:col-span-2 mt-4">
                <label className="block text-sm font-bold text-gray-700 mb-4">Product Images <span className="text-red-500">*</span></label>
                <div 
                  onClick={handleClickAddImages}
                  className={`w-full aspect-video md:aspect-[21/9] rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group ${
                    errors.images ? "border-red-500 bg-red-50/10" : "border-gray-200 bg-gray-50 hover:bg-orange-50/30 hover:border-[#ff5a36]/40"
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ImagePlus className="w-8 h-8 text-[#ff5a36]" />
                  </div>
                  <p className="text-gray-900 font-bold">Upload Image</p>
                  <p className="text-xs text-gray-400 mt-1">Click to select files (JPG, PNG, WebP up to 2MB)</p>
                </div>

                {images.length > 0 && (
                   <div className="mt-6 flex flex-wrap gap-4">
                      {images.map((img, idx) => (
                        <div key={idx} className={`relative w-24 h-24 rounded-2xl border-2 overflow-hidden group shadow-sm ${mainIndex === idx ? "border-[#ff5a36]" : "border-gray-100"}`}>
                           <img src={img.url} className="w-full h-full object-cover" />
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                             className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 shadow-md flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                           {mainIndex === idx && (
                             <div className="absolute bottom-0 left-0 right-0 bg-[#ff5a36] text-white text-[8px] font-bold py-0.5 text-center uppercase tracking-wider">Main</div>
                           )}
                           {mainIndex !== idx && (
                             <button 
                               onClick={() => setMainIndex(idx)}
                               className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                             >
                               Set Main
                             </button>
                           )}
                        </div>
                      ))}
                   </div>
                )}
              </div>
            </div>

            {formError && <p className="mt-6 text-sm text-red-500 text-center">{formError}</p>}
            {categoryError && <p className="mt-2 text-xs text-red-500 text-center">{categoryError}</p>}
          </div>

          {productType !== "PREORDER" && (
            <>
              <div id="product-options" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 md:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Options</h2>
                <p className="text-sm text-gray-500 mb-8 pb-4 border-b border-gray-50">Add product options like Color, Size (max 3 options).</p>
                
                <div className="space-y-6">
                  {options.map((opt, idx) => (
                    <OptionCard 
                      key={opt.id} 
                      option={opt}
                      index={idx}
                      updateOption={handleUpdateOption}
                      removeOption={handleRemoveOption}
                      productId={id ? Number(id) : undefined}
                      onDeleteValueImage={(keyId, valueId) => {
                        setDeletedOptionValueImageIds(prev => [...prev, { keyId, valueId }])
                      }}
                    />
                  ))}
                </div>

                <button 
                  onClick={handleAddOption}
                  disabled={options.length >= 3}
                  className="w-full py-4 mt-6 border-2 border-dashed border-[#ff5a36] text-[#ff5a36] rounded-xl font-bold hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Option (max 3 options)
                </button>
              </div>

              <div id="product-variants" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 md:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Variants</h2>
                <p className="text-sm text-gray-500 mb-8 pb-4 border-b border-gray-50">Set price and stock for each variant.</p>
                
                {variants.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500">No variants generated. Please add options in the previous step.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Delta Price for All (฿)</label>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={bulkDeltaPrice}
                            onChange={(e) => setBulkDeltaPrice(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-[#ff5a36]"
                            placeholder="0"
                          />
                          <button 
                            onClick={() => {
                              const delta = Number(bulkDeltaPrice)
                              if (!isNaN(delta)) {
                                setVariants(variants.map(v => ({ ...v, price_delta: delta })))
                              }
                            }}
                            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-bold text-gray-700"
                          >
                            Apply All
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Stock for All</label>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={bulkStock}
                            onChange={(e) => setBulkStock(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-[#ff5a36]"
                            placeholder="0"
                          />
                          <button 
                            onClick={() => {
                              const stock = Number(bulkStock)
                              if (!isNaN(stock) && stock >= 0) {
                                setVariants(variants.map(v => ({ ...v, stock_qty: stock })))
                              }
                            }}
                            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-bold text-gray-700"
                          >
                            Apply All
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 font-bold">
                          <tr>
                            <th className="px-6 py-4">Variant</th>
                            <th className="px-6 py-4">Delta Price (฿)</th>
                            <th className="px-6 py-4">Stock</th>
                            <th className="px-6 py-4">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {variants.map((v, i) => (
                            <tr key={v.id} className="hover:bg-orange-50/20 transition-colors">
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 rounded-full bg-orange-100 text-[#ff5a36] text-sm font-bold border border-orange-200">
                                  {v.option_value_labels.join(" / ")}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <input 
                                  type="number" 
                                  value={v.price_delta}
                                  onChange={(e) => {
                                    const val = Number(e.target.value)
                                    const newV = [...variants]
                                    newV[i].price_delta = val
                                    setVariants(newV)
                                  }}
                                  className="w-full max-w-[120px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#ff5a36]"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <input 
                                  type="number" 
                                  value={v.stock_qty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value)
                                    const newV = [...variants]
                                    newV[i].stock_qty = val >= 0 ? val : 0
                                    setVariants(newV)
                                  }}
                                  className="w-full max-w-[120px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#ff5a36]"
                                />
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900 border-l border-gray-50 bg-gray-50/30">
                                {(Number(price) || 0) + (v.price_delta || 0)} ฿
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
            <div className="mt-12 pt-8 flex items-center justify-end gap-4">
              <button
                type="button"
                className="px-10 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all"
                onClick={() => navigate("/store/products")}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-10 py-3.5 rounded-xl bg-[#ff5a36] text-white font-bold hover:bg-[#e04e2d] transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
              >
                {isSubmitting ? "Publishing..." : "Confirm & Publish Product"}
              </button>
            </div>
          </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_IMAGE_TYPES}
          multiple
          className="hidden"
          onChange={handleFilesChange}
        />
      </div>
  )
}
