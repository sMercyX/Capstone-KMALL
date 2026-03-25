import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, Trash2, Image as ImageIcon } from "lucide-react"
import { useCatagoriesApi } from "../../../api/catagoriesApi"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"
import ToggleSwitch from "../../../components/Toggle/ToggleSwitch"

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
    }
  }, [isEditMode, editData])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
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
    if (subCategories.length > 0) {
        toast.error("Cannot delete main category while it still has subcategories.")
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
    if (validSubs.length === 0) {
      toast.error("At least 1 subcategory is required")
      return
    }

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

  return (
    <div className="text-[#2D2D2D] mx-auto min-h-full">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-gray-400 text-sm mb-1 cursor-pointer hover:underline" onClick={() => navigate("/admin/category")}>
                Category &gt; Category Management &gt; <span className="text-gray-600 font-semibold">{isEditMode ? "Edit Category" : "Add Category"}</span>
                </p>
                <h1 className="text-2xl font-bold flex items-center gap-4">
                  {isEditMode ? "Edit Main Category" : "Add Main Category"}
                  {isEditMode && (
                     <button
                       onClick={() => setIsDeleteMainModalOpen(true)}
                       disabled={mainIsActive === "YES"}
                       className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  )}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                {isEditMode ? "Update the main category information and subcategories." : "Enter the main category information and add at least one subcategory."}
                </p>
            </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 px-2 flex-shrink-0">
        <div className="flex gap-8">
          <button
            onClick={() => scrollToSection("MAIN")}
            className={`py-4 px-2 font-medium text-sm relative transition-colors ${
              activeTab === "MAIN"
                ? "text-[#FF4C24]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Main Category
            {activeTab === "MAIN" && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FF4C24] rounded-t-lg" />
            )}
          </button>
          <button
            onClick={() => scrollToSection("SUB")}
            className={`py-4 px-2 font-medium text-sm relative transition-colors ${
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

      {/* Continuous Content Sections */}
      <div ref={contentRef} className="space-y-6 pb-40 pr-2">
        
        {/* Main Category Component */}
        <div id="MAIN" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 pt-8">
          <h2 className="text-lg font-bold mb-6">{isEditMode ? "Edit Main Category" : "Add Main Category"}</h2>
          
          <div className="space-y-6">
            {/* Category Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
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
              <div>
                <label className="block text-sm font-medium mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3 bg-[#F4F4F4] rounded-lg px-4 py-3">
                  <ToggleSwitch
                    checked={mainIsActive === "YES"}
                    onChange={(checked) => setMainIsActive(checked ? "YES" : "NO")}
                    disabled={isMainToggleDisabled}
                  />
                  <span className={`font-medium text-sm ${mainIsActive === "YES" ? "text-green-600" : "text-gray-500"}`}>
                    {mainIsActive === "YES" ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">To set as Active, at least one subcategory must also be Active. To set as Inactive, all subcategories must be Inactive.</p>
              </div>
            )}

            {/* Category Image */}
            <div>
              <label className="block text-sm font-medium mb-2">
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
                accept="image/jpeg, image/png, image/webp"
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
                  <li>Accepted formats: JPG, PNG, or WebP</li>
                </ul>
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="mt-4 rounded-lg overflow-hidden h-48 border border-gray-200">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub Category Component */}
        <div id="SUB" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 pt-8 min-h-[400px]">
          <h2 className="text-lg font-bold mb-1">{isEditMode ? "Edit Subcategory" : "Add Subcategory"}</h2>
          <p className="text-sm text-gray-500 mb-6">Enter the subcategory name</p>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">
                Subcategories <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">At least 1 subcategory is required</span>
            </div>
            
            {/* Input for adding new subcategory */}
            <div className="flex gap-3 mb-4">
               <input 
                  type="text" 
                  placeholder="e.g., Jeans, T-Shirts"
                  className="flex-grow bg-[#F4F4F4] border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-gray-400 transition-all text-sm font-medium text-[#2D2D2D]"
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
                <div key={sub.id || `new-${index}`} className="flex justify-between items-center bg-white border border-gray-300 rounded-lg px-4 py-2">
                  <input 
                    type="text" 
                    placeholder="Subcategory Name"
                    className="flex-grow bg-transparent border-none outline-none font-medium text-[#2D2D2D] text-sm py-1 px-2 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors cursor-text"
                    value={sub.name}
                    onChange={(e) => handleSubCategoryChange(index, e.target.value)}
                  />
                  {sub.product_count !== undefined && (
                    <span className="text-[#FF4C24] text-xs font-semibold px-2 shrink-0">
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
                        <div className="flex items-center text-xs font-semibold bg-orange-50 text-[#FF4C24] px-3 py-1.5 rounded-full border border-orange-100 mr-2 shadow-sm animate-pulse-slow">
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
                          <div className="flex flex-col text-xs items-end mr-2">
                             <span className="text-xs text-blue-400 font-semibold whitespace-nowrap">
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

      {/* Floating Footer Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[280px] bg-[#F9F9F9] border-t border-gray-200 p-4 flex justify-end gap-4 z-50">
        <div className="w-full flex justify-end gap-4">
          <button 
            onClick={() => setIsCancelModalOpen(true)}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-md font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-md font-medium text-white bg-[#FF4C24] hover:bg-[#E63E1A] transition-colors disabled:opacity-50"
          >
            {isLoading ? "Saving..." : isEditMode ? "Update Category" : "Create Category"}
          </button>
        </div>
      </div>

      {/* Delete Main Category Confirmation */}
      <ConfirmationModal
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
      >
        <div className="flex flex-col gap-4 mt-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Subcategory</label>
                <select 
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5"
                    value={selectedSubForReassign}
                    onChange={(e) => {
                        const val = e.target.value
                        const num = Number(val)
                        // If it's a numeric ID, store as number, otherwise it's the name (string)
                        setSelectedSubForReassign(!isNaN(num) && val.trim() !== "" ? num : val)
                    }}
                >
                    <option value="" disabled>Select Subcategory...</option>
                    {availableSubcategoriesForReassign.map((sub, idx) => (
                        <option key={sub.id || `new-target-${idx}`} value={sub.id || sub.name}>{sub.name}</option>
                    ))}
                    {availableSubcategoriesForReassign.length === 0 && (
                        <option value="" disabled>No valid subcategories found to transfer products.</option>
                    )}
                </select>
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
