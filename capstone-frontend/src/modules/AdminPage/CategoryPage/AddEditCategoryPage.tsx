import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2, Image as ImageIcon, Package } from "lucide-react"
import { useCatagoriesApi } from "../../../api/catagoriesApi"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"
import ToggleSwitch from "../../../components/Toggle/ToggleSwitch"
import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../utils/imageProcessing"
import { Dropdown } from "../../../components/Dropdown/Dropdown"

// Interface for Subcategories to hold ID
interface SubCategoryItem {
  id?: number
  name: string
  is_active: string
  product_count?: number
}

export default function AddCategoryPage() {
  const navigate = useNavigate()
  const { addCategory, deleteCategory, getAdminCategories, deactivateCategory } = useCatagoriesApi()

  const { categoryname } = useParams<{ categoryname: string }>()
  const isEditMode = !!categoryname

  const [editData, setEditData] = useState<{
    main: { id: number; name: string; icon_url: string; is_active: string }
    subs: { id: number; name: string; is_active: string; product_count?: number }[]
  } | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [mainName, setMainName] = useState("")
  const [mainIsActive, setMainIsActive] = useState("NO")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([])
  const [newSubCategoryName, setNewSubCategoryName] = useState("")
  const [activeTab, setActiveTab] = useState<string>("MAIN")

  // Modals state
  const [isDeleteMainModalOpen, setIsDeleteMainModalOpen] = useState(false)
  
  // Reassign Modal State
  const [reassignModalState, setReassignModalState] = useState<{
    isOpen: boolean
    subcategoryId: number | null
    subcategoryName: string
    type: 'DELETE' | 'DEACTIVATE'
  }>({ isOpen: false, subcategoryId: null, subcategoryName: "", type: 'DELETE' })
  
  const [availableSubcategoriesForReassign, setAvailableSubcategoriesForReassign] = useState<{ id?: number; name: string }[]>([])
  const [selectedSubForReassign, setSelectedSubForReassign] = useState<number | string | "">("")
  const [pendingDeactivations, setPendingDeactivations] = useState<Record<number, { target: number | string; type: 'DELETE' | 'DEACTIVATE' }>>({})
  const [pendingDeletions, setPendingDeletions] = useState<number[]>([])
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [initialFormState, setInitialFormState] = useState<{
    name: string;
    isActive: string;
    subs: SubCategoryItem[];
  } | null>(null)
  const isScrolling = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollToSection = (tab: string) => {
    setActiveTab(tab)
    isScrolling.current = true
    const element = document.getElementById(tab)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(() => {
      isScrolling.current = false
    }, 800)
  }

  const getSourcesByTarget = (targetIdOrName: number | string) => {
    return Object.entries(pendingDeactivations)
      .filter(([_, data]) => data.target === targetIdOrName)
      .map(([sourceId, _]) => {
         const sid = Number(sourceId);
         return subCategories.find(s => s.id === sid)?.name || 
                editData?.subs.find(s => s.id === sid)?.name || 
                `ID ${sid}`;
      });
  };

  useEffect(() => {
    const root = contentRef.current?.closest('main') || null
    if (!root) return

    const handleScroll = () => {
      if (isScrolling.current) return
      // Force MAIN tab if scrolled near the top
      if (root.scrollTop < 80) {
        setActiveTab("MAIN")
      }
    }
    root.addEventListener("scroll", handleScroll)

    const observer = new IntersectionObserver((entries) => {
      if (isScrolling.current) return
      
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (root.scrollTop >= 80) {
            setActiveTab(entry.target.id)
          }
        }
      })
    }, {
      root: root,
      rootMargin: "-15% 0px -60% 0px",
      threshold: 0
    })

    const tabs = ["MAIN", "SUB"]
    tabs.forEach(tab => {
      const el = document.getElementById(tab)
      if (el) observer.observe(el)
    })

    return () => {
      root.removeEventListener("scroll", handleScroll)
      observer.disconnect()
    }
  }, [])

  // Fetch data if editing
  useEffect(() => {
    async function fetchCategoryData() {
      if (!isEditMode || !categoryname) return
      setIsLoading(true)
      try {
        // Fetch subcategories
        const subRes = await getAdminCategories({  parent_id: categoryname })
        // Fetch only main categories to find the main category info
        const mainRes = await getAdminCategories({  parent_id: null })
        const mainCat = mainRes.data?.find((c: any) => c.slug === categoryname && (!c.parent_id || c.parent_id === 0))
        
        if (mainCat) {
          setEditData({
            main: { id: mainCat.id, name: mainCat.name, icon_url: mainCat.icon_url || "", is_active: mainCat.is_active || "NO" },
            subs: subRes.data ? subRes.data.map((s: any) => ({ 
              id: s.id, 
              name: s.name, 
              is_active: s.is_active || "NO",
              product_count: s.product_count || 0
            })) : []
          })
        } else {
          toast.error("Category not found")
          navigate("/admin/category")
        }
      } catch (error) {
        toast.error("Failed to load category data")
        navigate("/admin/category")
      } finally {
        setIsLoading(false)
      }
    }
    fetchCategoryData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryname, isEditMode])

  useEffect(() => {
    if (isEditMode && editData) {
      setMainName(editData.main.name)
      setMainIsActive(editData.main.is_active)
      if (editData.main.icon_url) {
        setImagePreview(resolveImageUrl(editData.main.icon_url))
      }
      if (editData.subs && editData.subs.length > 0) {
        setSubCategories(editData.subs.map(sub => ({ 
          id: sub.id, 
          name: sub.name, 
          is_active: sub.is_active,
          product_count: sub.product_count
        })))
      }
      // Set initial state for dirty check
      if (!initialFormState) {
        setInitialFormState({
          name: editData.main.name,
          isActive: editData.main.is_active,
          subs: editData.subs.map(sub => ({
            id: sub.id,
            name: sub.name,
            is_active: sub.is_active,
            product_count: sub.product_count
          }))
        })
      }
    } else if (!isEditMode && !initialFormState) {
       // For Add Mode, initial state is empty
       setInitialFormState({
         name: "",
         isActive: "NO",
         subs: []
       })
    }
  }, [isEditMode, editData, initialFormState])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0]
      try {
        file = await processImageFile(file)
      } catch (err) {
        // processImageFile already shows toast
        return
      }
      // Basic validation
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size must be less than 2MB")
        return
      }
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubCategoryChange = (index: number, value: string) => {
    setSubCategories(prev => {
      const newSubs = [...prev]
      newSubs[index] = { ...newSubs[index], name: value }
      return newSubs
    })
  }

  const handleSubCategoryActiveChange = (index: number, newActive: string) => {
    const sub = subCategories[index]
    
    // If toggling from YES to NO and it has products, prompt for reassignment
    if (sub.is_active === "YES" && newActive === "NO" && sub.id && (sub.product_count || 0) > 0) {
      setReassignModalState({
        isOpen: true,
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        type: 'DEACTIVATE'
      })
      
      const validReassignTargets = subCategories
        .filter(s => s.id !== sub.id && s.name.trim() !== "")
        .map(s => ({ id: s.id, name: s.name }))
      
      setAvailableSubcategoriesForReassign(validReassignTargets)
      return
    }

    const newSubs = [...subCategories]
    newSubs[index].is_active = newActive
    setSubCategories(newSubs)

    // If it was pending deactivation, remove it if toggled back to YES
    if (newActive === "YES" && sub.id) {
      setPendingDeactivations(prev => {
        const next = { ...prev }
        delete next[sub.id!]
        return next
      })
    }
  }

  const handleAddSubCategory = () => {
    if (!newSubCategoryName.trim()) return
    setSubCategories([...subCategories, { name: newSubCategoryName.trim(), is_active: "NO" }])
    setNewSubCategoryName("")
  }

  const removeSubCategoryRow = (index: number) => {
    const subToDelete = subCategories[index]

    if (subToDelete.id) {
       // Track existing subcategory for deletion on save
       setPendingDeletions(prev => [...prev, subToDelete.id!])
       // Also remove from pending deactivations if it was there
       setPendingDeactivations(prev => {
         const next = { ...prev }
         delete next[subToDelete.id!]
         return next
       })
    }
    
    // Remove from local list
    const newSubs = [...subCategories]
    newSubs.splice(index, 1)
    setSubCategories(newSubs)
  }

  const handleConfirmReassign = async () => {
    if (!reassignModalState.subcategoryId || selectedSubForReassign === "") return

    // 1. Store the move and its type for Phase 5 in handleSubmit
    setPendingDeactivations(prev => ({
      ...prev,
      [reassignModalState.subcategoryId!]: { 
        target: selectedSubForReassign, 
        type: reassignModalState.type 
      }
    }))

    // 2. Update local state
    if (reassignModalState.type === 'DELETE') {
      // Remove from tree for the main POST
      setSubCategories(prev => prev.filter(sub => sub.id !== reassignModalState.subcategoryId))
    } else {
      // Keep in tree but set as inactive locally
    setSubCategories(prev => prev.map(sub => 
        sub.id === reassignModalState.subcategoryId ? { ...sub, is_active: "NO" } : sub
      ))
    }

    // 3. Force Target to be Active
    setSubCategories(prev => prev.map(sub => {
      if (typeof selectedSubForReassign === 'number' && sub.id === selectedSubForReassign) {
        return { ...sub, is_active: "YES" }
      }
      if (typeof selectedSubForReassign === 'string' && sub.name === selectedSubForReassign) {
        return { ...sub, is_active: "YES" }
      }
      return sub
    }))

    const targetName = typeof selectedSubForReassign === 'number' 
      ? availableSubcategoriesForReassign.find(s => s.id === selectedSubForReassign)?.name 
      : selectedSubForReassign

    toast.info(`Products from "${reassignModalState.subcategoryName}" will be moved to "${targetName}" when you update. "${targetName}" has been set to Active.`)
    
    setReassignModalState(prev => ({ ...prev, isOpen: false, subcategoryId: null }))
    setSelectedSubForReassign("")
  }

  const handleDeleteMainCategory = async () => {
    if (!editData) return
    // 1. Check if ANY subcategory has products
    const totalProducts = subCategories.reduce((sum, s) => sum + (s.product_count || 0), 0)
    if (totalProducts > 0) {
        toast.error(`Cannot delete: This category still has ${totalProducts} products. Please move or delete the products first.`)
        setIsDeleteMainModalOpen(false)
        return
    }
    try {
        setIsLoading(true)
        await deleteCategory(editData.main.id)
        toast.success(`Main category "${editData.main.name}" deleted successfully.`)
        navigate("/admin/category")
    } catch (error: any) {
        toast.error(error.message || "Failed to delete main category.")
    } finally {
        setIsLoading(false)
        setIsDeleteMainModalOpen(false)
    }
  }

  const handleSubmit = async () => {
    if (!mainName.trim()) {
      toast.error("Please enter a Main Category name")
      return
    }
    if (!isEditMode && !imageFile) {
      toast.error("Please select a Category Image")
      return
    }
    
    const validSubs = subCategories.filter(s => s.name.trim() !== "")

    if (isEditMode) {
      const activeSubCount = validSubs.filter(s => s.is_active === "YES").length
      if (mainIsActive === "YES" && activeSubCount === 0) {
        toast.error("At least one subcategory must be Active to set the Main Category as Active")
        return
      }
      if (mainIsActive === "NO" && activeSubCount > 0) {
        toast.error("All subcategories must be Inactive before setting the Main Category as Inactive")
        return
      }
    }

    try {
      setIsLoading(true)

      // Phase 1: Identify all pending deactivations
      const deactivationIds = Object.keys(pendingDeactivations)
      const allMoves = deactivationIds.map(id => ({
        subId: Number(id),
        ...pendingDeactivations[Number(id)]
      }))

      const payload: any = {
        main_category: {
          name: mainName.trim(),
          is_active: isEditMode ? mainIsActive : "NO",
        },
        sub_categories: validSubs.map((sub) => {
          let isActive = isEditMode ? sub.is_active : "NO"
          
          // CRITICAL: Force active for any sub involved in a pending move (source OR target)
          // to bypass backend validation and allow product movement later.
          const isSource = allMoves.find(m => m.subId === sub.id)
          const isTarget = allMoves.find(m => m.target === sub.id || m.target === sub.name)

          if (isSource || isTarget) {
            isActive = "YES"
          }

          return {
            name: sub.name.trim(),
            is_active: isActive
          }
        })
      }

      if (isEditMode && editData) {
        payload.main_category.id = editData.main.id
        payload.main_category.icon_url = editData.main.icon_url
        
        payload.sub_categories = validSubs.map((sub) => {
          let isActive = sub.is_active
          
          // Force active for any sub involved in a pending move
          const isSource = allMoves.find(m => m.subId === sub.id)
          const isTarget = allMoves.find(m => m.target === sub.id || m.target === sub.name)

          if (isSource || isTarget) {
            isActive = "YES"
          }

          const subItem: any = {
            name: sub.name.trim(),
            is_active: isActive
          }
          if (sub.id) {
            subItem.id = sub.id
          }
          return subItem
        })
      }

      const formData = new FormData()
      formData.append("data", JSON.stringify(payload))
      if (imageFile) {
        formData.append("file", imageFile)
      }

      const response = await addCategory(formData, isEditMode ? editData?.main.id : undefined)

      // Phase 4 & 5: Execute ALL deactivations and deletions AFTER the main category is saved
      if (response.data?.sub_categories) {
        const updatedSubs = response.data.sub_categories as { id: number; name: string }[]
        
        // Handle pending deactivations (Move & Deactivate or Move & Delete via modal)
        if (allMoves.length > 0) {
          for (const move of allMoves) {
            let targetId: number | undefined
            if (typeof move.target === 'number') {
              targetId = move.target
            } else {
              targetId = updatedSubs.find(s => s.name === move.target)?.id
            }

            if (targetId) {
              if (move.type === 'DELETE') {
                await deleteCategory(move.subId, targetId)
              } else {
                await deactivateCategory(move.subId, targetId)
              }
            }
          }
        }

        // Handle simple pending deletions (No target specified yet)
        if (pendingDeletions.length > 0) {
          for (const id of pendingDeletions) {
             try {
                // Try deleting directly. 
                // If it fails with products, we'll try to find an automatic target
                await deleteCategory(id)
             } catch (error: any) {
                if (error.response?.status === 400 || error.message?.toLowerCase().includes("move to sub catagory")) {
                   // Automatic target selection: Pick the first available active subcategory
                   const targetSub = validSubs.find(s => s.is_active === "YES" && s.id !== id)
                   let targetId = targetSub?.id
                   
                   // If the target is a new subcategory, find its ID from the response
                   if (targetSub && !targetId) {
                      targetId = updatedSubs.find(s => s.name === targetSub.name)?.id
                   }

                   if (targetId) {
                      await deleteCategory(id, targetId)
                   } else {
                      const subName = editData?.subs.find(s => s.id === id)?.name || id
                      toast.error(`Could not delete "${subName}" because it has products and no active target subcategory was found.`)
                   }
                }
             }
          }
        }
      }

      toast.success(isEditMode ? "Category updated successfully" : "Category added successfully")
      navigate("/admin/category")
      
    } catch (error: any) {
      console.error("Failed to add category:", error)
      toast.error(error.message || "Failed to add category")
    } finally {
      setIsLoading(false)
    }
  }

  const activeSubCount = subCategories.filter(s => s.is_active === "YES").length
  const isMainToggleDisabled = 
    (mainIsActive === "NO" && activeSubCount === 0) || 
    (mainIsActive === "YES" && activeSubCount > 0)

  const isDirty = () => {
    if (!initialFormState) return false;
    
    // Check main category changes
    if (mainName !== initialFormState.name) return true;
    if (mainIsActive !== initialFormState.isActive) return true;
    if (imageFile !== null) return true; // Image selected always counts as dirty
    
    // Check subcategory changes
    if (subCategories.length !== initialFormState.subs.length) return true;
    
    for (let i = 0; i < subCategories.length; i++) {
        const current = subCategories[i];
        const initial = initialFormState.subs[i];
        if (!initial || current.name !== initial.name || current.is_active !== initial.is_active || current.id !== initial.id) {
            return true;
        }
    }

    // Check pending deletions/deactivations
    if (pendingDeletions.length > 0) return true;
    if (Object.keys(pendingDeactivations).length > 0) return true;

    return false;
  }

  const handleCancelClick = () => {
    if (isDirty()) {
      setIsCancelModalOpen(true)
    } else {
      navigate("/admin/category")
    }
  }

  return (
    <div className="h-full flex flex-col text-[#2D2D2D] overflow-hidden">
      {/* Fixed Header section */}
      <div className="shrink-0 bg-gray-50 border-b border-gray-200/50">
        <div className=" mx-auto">
          {/* Breadcrumbs */}
          <div className="mb-4">
              <p className="text-gray-400 text-description mb-1 ">
              Admin &gt; <span className="hover:text-orange-500 cursor-pointer" onClick={handleCancelClick}>Category Management</span> &gt; <span className="text-gray-600 font-semibold">{isEditMode ? "Edit Category" : "Add Category"}</span>
              </p>
              <h1 className="text-header font-bold flex items-center gap-4">
                {isEditMode ? "Edit Main Category" : "Add Main Category"}
                {isEditMode && (
                   <button
                     onClick={() => setIsDeleteMainModalOpen(true)}
                     className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                )}
              </h1>
              <p className="text-gray-500 text-description">
              {isEditMode ? "Update the main category information and subcategories." : "Enter the main category information and add at least one subcategory."}
              </p>
          </div>

          {/* Navigation Tabs (Inside Fixed Header) */}
          <div className="bg-white rounded-lg text-description shadow-sm border border-gray-200 px-2 flex-shrink-0 mb-4">
            <div className="flex gap-8">
              <button
                onClick={() => scrollToSection("MAIN")}
                className={`py-4 px-2 font-medium relative transition-colors cursor-pointer ${
                  activeTab === "MAIN"
                    ? "text-[#FF4C24]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Main Category
                {activeTab === "MAIN" && (
                  <div className="absolute  bottom-0 left-0 right-0 h-[3px] bg-[#FF4C24] rounded-t-lg" />
                )}
              </button>
              <button
                onClick={() => scrollToSection("SUB")}
                className={`py-4 px-2 font-medium relative transition-colors cursor-pointer ${
                  activeTab === "SUB"
                    ? "text-[#FF4C24]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Subcategory
                {activeTab === "SUB" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FF4C24] rounded-t-lg" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content section */}
      <div 
        ref={contentRef} 
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#F1F1F1] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D1D1D1] hover:[&::-webkit-scrollbar-thumb]:bg-[#B1B1B1] [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        <div className="mx-auto space-y-6 pb-20">
          {/* Main Category Component */}
          <div id="MAIN" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 pt-8">
            <h2 className="text-header font-bold mb-6">{isEditMode ? "Edit Main Category" : "Add Main Category"}</h2>
            
            <div className="space-y-6">
              {/* Category Name */}
              <div className="text-text">
                <label className="block font-medium mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., Clothing, Shoes, Bags"
                  className="w-full bg-[#F4F4F4] border-none rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF4C24]/50"
                  value={mainName}
                  onChange={(e) => setMainName(e.target.value)}
                />
              </div>

              {/* Category Status (Edit Mode Only) */}
              {isEditMode && (
                <div className="text-text">
                  <label className="block font-medium mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 bg-[#F4F4F4] rounded-lg px-4 py-3">
                    <ToggleSwitch
                      checked={mainIsActive === "YES"}
                      onChange={(checked) => setMainIsActive(checked ? "YES" : "NO")}
                      disabled={isMainToggleDisabled}
                    />
                    <span className={`font-medium ${mainIsActive === "YES" ? "text-green-600" : "text-gray-500"}`}>
                      {mainIsActive === "YES" ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">To set as Active, at least one subcategory must also be Active. To set as Inactive, all subcategories must be Inactive.</p>
                </div>
              )}

              {/* Category Image */}
              <div className="text-text">
                <label className="block font-medium mb-2">
                  Category Image {!isEditMode && <span className="text-red-500">*</span>}
                </label>
                
                <div 
                  className="w-full bg-[#F4F4F4] border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Choose File</span>
                    <span className="text-gray-500 text-sm">{imageFile ? imageFile.name : "No file Chosen"}</span>
                  </div>
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept={SUPPORTED_IMAGE_TYPES}
                  onChange={handleFileChange}
                />

                {/* Image Guidelines */}
                <div className="mt-4 bg-[#FFF9DA] border border-[#F2D750]/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-[#9A7D0A] font-medium mb-2">
                    <ImageIcon className="w-5 h-5" />
                    Image Guidelines
                  </div>
                  <ul className="list-disc list-inside text-xs text-[#9A7D0A] space-y-1 ml-1 opacity-90">
                    <li>Recommended size: 800 × 450 px (16:9 ratio)</li>
                    <li>Maximum file size: 2 MB</li>
                    <li>Accepted formats: JPG, PNG, WebP, or HEIF/HEIC</li>
                  </ul>
                </div>

                {/* Mock Card Preview */}
                <div className="mt-8 flex flex-col items-center">
                  <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">Preview in Dashboard</p>
                  <div className="w-full max-w-[200px] rounded-3xl border border-orange-200 bg-white shadow-[0_8px_20px_rgba(255,102,0,0.12)] px-6 py-6 text-center transform scale-90 sm:scale-100 transition-transform">
                    <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-orange-50 grid place-items-center overflow-hidden mb-4 border-2 border-orange-100/50">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-10 w-10 sm:h-12 w-12 text-orange-400" />
                      )}
                    </div>
                    <div className="font-bold text-base sm:text-lg text-gray-800 truncate">
                      {mainName || "Category Name"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub Category Component */}
          <div id="SUB" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 pt-8 min-h-[400px]">
            <h2 className="text-header font-bold mb-1">{isEditMode ? "Edit Subcategory" : "Add Subcategory"}</h2>
            <p className="text-description text-gray-500 mb-6">Enter the subcategory name</p>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-text font-medium">
                  Subcategories
                </label>
                <span className="text-description text-gray-400">Add subcategories for this category</span>
              </div>
              
              {/* Input for adding new subcategory */}
              <div className="flex gap-3 mb-4 text-text">
                 <input 
                    type="text" 
                    placeholder="e.g., Jeans, T-Shirts"
                    className="flex-grow bg-[#F4F4F4] border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-gray-400 transition-all font-medium text-[#2D2D2D]"
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSubCategory()
                        }
                    }}
                 />
                 <button 
                    onClick={handleAddSubCategory}
                    className="bg-[#2D2D2D] hover:bg-black text-white w-12 h-12 rounded-lg flex items-center justify-center transition-colors shrink-0"
                 >
                    <Plus className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-3">
                {subCategories.map((sub, index) => (
                  <div key={sub.id || `new-${index}`} className="flex text-text justify-between items-center bg-white border border-gray-300 rounded-lg px-4 py-2">
                    <input 
                      type="text" 
                      placeholder="Subcategory Name"
                      className="flex-grow bg-transparent border-none outline-none font-medium text-[#2D2D2D] py-1 px-2 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors cursor-text"
                      value={sub.name}
                      onChange={(e) => handleSubCategoryChange(index, e.target.value)}
                    />
                    {sub.product_count !== undefined && (
                      <span className="text-[#FF4C24] text-description font-semibold px-2 shrink-0">
                        {sub.product_count} items
                      </span>
                    )}
                    {isEditMode && (
                      <div className="ml-2 flex items-center pr-4 border-r border-gray-200">
                        <ToggleSwitch
                          checked={sub.is_active === "YES"}
                          onChange={(checked) => handleSubCategoryActiveChange(index, checked ? "YES" : "NO")}
                          disabled={Object.values(pendingDeactivations).some(d => d.target === sub.id || d.target === sub.name)}
                        />
                      </div>
                    )}
                    <div className="flex gap-2 shrink-0 ml-4">
                        {pendingDeactivations[sub.id!] && (
                          <div className="flex items-center text-description font-semibold bg-orange-50 text-[#FF4C24] px-3 py-1.5 rounded-full border border-orange-100 mr-2 shadow-sm">
                            <span className="opacity-70 mr-1.5">{pendingDeactivations[sub.id!].type === 'DELETE' ? 'Move & Delete' : 'Move & Deactivate'} →</span>
                            <span>{
                              typeof pendingDeactivations[sub.id!].target === 'number'
                                ? subCategories.find(s => s.id === pendingDeactivations[sub.id!].target)?.name
                                : pendingDeactivations[sub.id!].target
                            }</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          {Object.values(pendingDeactivations).some(d => d.target === sub.id || d.target === sub.name) && (
                            <div className="flex flex-col text-description items-end mr-2">
                               <span className="text-description text-blue-400 font-semibold whitespace-nowrap">
                                  Receiving from: {getSourcesByTarget(sub.id || sub.name).join(", ")}
                               </span>
                            </div>
                          )}
                          <button 
                            onClick={() => removeSubCategoryRow(index)}
                            disabled={
                              sub.is_active === "YES" || 
                              Object.values(pendingDeactivations).some(d => d.target === sub.id || d.target === sub.name) ||
                              !!pendingDeactivations[sub.id!]
                            }
                            className="text-red-500 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors p-1"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          
        </div>
      </div>

         {/* Footer Toolbar section */}
      <div className="shrink-0 bg-white border border-gray-200 rounded-lg mt-4">
        <div className=" mx-auto flex justify-end gap-4 text-text my-4 mr-4">
          <button 
            onClick={handleCancelClick}
            disabled={isLoading}
            className="px-2 py-2 cursor-pointer rounded-lg bg-[#8E8E93] text-white hover:bg-[#7A7A7F] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 cursor-pointer rounded-lg  bg-[#FF4C24] text-white hover:bg-[#E63E1A] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-md shadow-orange-200"
          >
            {isLoading ? "Saving..." : isEditMode ? "Update Category" : "Create Category"}
          </button>
        </div>
      </div>

      {/* Delete Main Category Confirmation */}
      <ConfirmationModal
        key={editData?.main.id}
        isOpen={isDeleteMainModalOpen}
        onClose={() => setIsDeleteMainModalOpen(false)}
        onConfirm={handleDeleteMainCategory}
        title="Delete Main Category"
        message={`Are you sure you want to delete "${editData?.main.name}"? This action cannot be undone and will affect all subcategories under it.`}
        confirmText="Delete"
        variant="danger"
      />

       {/* Subcategory Reassign Modal */}
       <ConfirmationModal
        key={reassignModalState.subcategoryId}
        isOpen={reassignModalState.isOpen}
        onClose={() => setReassignModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmReassign}
        title={reassignModalState.type === 'DELETE' ? "Delete Subcategory" : "Category Has Products"}
        message={reassignModalState.type === 'DELETE' 
          ? `You cannot delete "${reassignModalState.subcategoryName}" because there are products inside. Please select a new category to move these products to before deleting.`
          : `"${reassignModalState.subcategoryName}" still has products. Please select a new category to move these products to before deactivating.`
        }
        confirmText={reassignModalState.type === 'DELETE' ? "Move & Delete" : "Move & Deactivate"}
        confirmDisabled={selectedSubForReassign === ""}
        variant="warning"
        isOverflowVisible={true}
      >
        <div className="flex flex-col gap-4 mt-6">
            <div>
                <label className="block text-description font-medium text-gray-700 mb-2">Target Subcategory</label>
                <Dropdown
                    label="Target Subcategory"
                    options={availableSubcategoriesForReassign.map(sub => ({
                        id: sub.id || sub.name,
                        name: sub.name
                    }))}
                    value={selectedSubForReassign}
                    onChange={(val) => setSelectedSubForReassign(val)}
                    placeholder="Select Subcategory..."
                    allLabel={null}
                />
            </div>
        </div>
      </ConfirmationModal>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={() => navigate("/admin/category")}
        title="Unsaved Changes"
        message="Are you sure you want to leave? Any unsaved changes will be lost."
        confirmText="Leave Page"
        variant="danger"
      />

    </div>
  )
}
