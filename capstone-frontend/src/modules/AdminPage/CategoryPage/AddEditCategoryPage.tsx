import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Plus, Trash2, Image as ImageIcon } from "lucide-react"
import { useCatagoriesApi } from "../../../api/catagoriesApi"
import { toast } from "react-toastify"
import { resolveImageUrl } from "../../../utils/resolve"

export default function AddCategoryPage() {
  const navigate = useNavigate()
  const { addCategory, updateCategory, uploadCategoryIcon } = useCatagoriesApi()

  const location = useLocation()
  // Explicitly check for edit data passed from CategoryPage
  const editData = location.state as {
    main: { id: number; name: string; icon_url: string }
    subs: { id: number; name: string }[]
  } | null
  
  const isEditMode = !!editData

  const [isLoading, setIsLoading] = useState(false)
  const [mainName, setMainName] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [subCategories, setSubCategories] = useState<string[]>([""])
  const [activeTab, setActiveTab] = useState<string>("MAIN")
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

  useEffect(() => {
    const root = contentRef.current
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

  useEffect(() => {
    if (isEditMode && editData) {
      setMainName(editData.main.name)
      if (editData.main.icon_url) {
        setImagePreview(resolveImageUrl(editData.main.icon_url))
      }
      if (editData.subs && editData.subs.length > 0) {
        setSubCategories(editData.subs.map(sub => sub.name))
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
    const newSubs = [...subCategories]
    newSubs[index] = value
    setSubCategories(newSubs)
  }

  const addSubCategoryRow = (index: number) => {
    const newSubs = [...subCategories]
    newSubs.splice(index + 1, 0, "")
    setSubCategories(newSubs)
  }

  const removeSubCategoryRow = (index: number) => {
    if (subCategories.length > 1) {
      const newSubs = [...subCategories]
      newSubs.splice(index, 1)
      setSubCategories(newSubs)
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
    
    // Filter out empty subcategories
    const validSubs = subCategories.map(s => s.trim()).filter(Boolean)
    if (validSubs.length === 0) {
      toast.error("At least 1 subcategory is required")
      return
    }

    try {
      setIsLoading(true)

      // 1. Upload the icon only if a new file is chosen
      let iconUrl = isEditMode ? editData!.main.icon_url : ""
      
      if (imageFile) {
        const uploadRes = await uploadCategoryIcon(imageFile)
        iconUrl = uploadRes?.data?.icon_url
        if (!iconUrl) {
          throw new Error("Failed to upload image. No icon_url returned.")
        }
      }

      if (isEditMode) {
        // Edit mode API call 
        const updatePayload = {
          name: mainName.trim(),
          icon_url: iconUrl
        }
        await updateCategory(editData!.main.id, updatePayload)
        
        // Find new subcategories (ones that weren't in editData.subs originally)
        const originalSubNames = editData?.subs.map(s => s.name) || []
        const newSubs = validSubs.filter(sub => !originalSubNames.includes(sub))
        
        if (newSubs.length > 0) {
           const subcatPayload = {
             main_category: {
               id: editData!.main.id // specify ID to indicate we are attaching to existing
             },
             sub_categories: newSubs.map(sub => ({
               name: sub.trim(),
               sort_order: 10
             }))
           }
           await addCategory(subcatPayload)
        }

      } else {
        // Add mode API call
        const payload = {
          main_category: {
            name: mainName.trim(),
            icon_url: iconUrl,
            sort_order: 1
          },
          sub_categories: validSubs.map((sub, index) => ({
            name: sub.trim(),
            sort_order: (index + 1) * 10
          }))
        }
        await addCategory(payload)
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

  return (
    <div className="p-6 md:p-8 text-[#2D2D2D] mx-auto h-[calc(100vh-60px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <p className="text-gray-500 text-sm mb-1 cursor-pointer" onClick={() => navigate("/admin/category")}>
          Category &gt; Category Management &gt; <span className="text-gray-800">{isEditMode ? "Edit Category" : "Add Category"}</span>
        </p>
        <h1 className="text-2xl font-bold">{isEditMode ? "Edit Main Category" : "Add Main Category"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isEditMode ? "Update the main category information and subcategories." : "Enter the main category information and add at least one subcategory."}
        </p>
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
      <div ref={contentRef} className="flex-1 overflow-y-auto space-y-6 pb-32 pr-2 scroll-smooth">
        
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
            
            <div className="space-y-3">
              {subCategories.map((subName, index) => (
                <div key={index} className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Subcategory Name"
                    className="flex-grow bg-[#F4F4F4] border-none rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF4C24]/50"
                    value={subName}
                    onChange={(e) => handleSubCategoryChange(index, e.target.value)}
                  />
                  
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => addSubCategoryRow(index)}
                      className="bg-[#2D2D2D] hover:bg-black text-white w-12 h-12 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {subCategories.length > 1 && (
                      <button 
                        onClick={() => removeSubCategoryRow(index)}
                        className="bg-white border border-[#FF4C24] text-[#FF4C24] hover:bg-[#FFF8F6] w-12 h-12 rounded-lg flex items-center justify-center transition-colors shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Footer Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F9F9F9] border-t border-gray-200 p-4 md:pl-64 flex justify-end gap-4 z-50">
        <div className="max-w-5xl w-full mx-auto flex justify-end gap-4 pr-6">
          <button 
            onClick={() => navigate("/admin/category")}
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
    </div>
  )
}
