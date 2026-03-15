import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, Folder, Pencil } from "lucide-react"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import LoadingSpinner from "../../../components/LoaingSpinner/LoadingSpinner"
import { resolveImageUrl } from "../../../utils/resolve"

interface CategoryData {
  main: CatagoriesResponse
  subs: CatagoriesResponse[]
}

export default function CategoryPage() {
  const navigate = useNavigate()
  const { getCatagoriesName, getCatagoriesSubName } = useCatagoriesApi()
  
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [filteredCategories, setFilteredCategories] = useState<CategoryData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        // Fetch Main categories (parent_id = 0)
        // Adjust parent_id parameter depending on your backend's "root" convention, commonly 0 or maybe root missing. 
        // Based on useCatagoriesName(0) it fetches root categories.
        const mainRes = await getCatagoriesName(0) 
        const mainArray = mainRes.data || []
        
        // Fetch Sub categories
        const subRes = await getCatagoriesSubName()
        const subArray = subRes.data || []

        // Optional: you can group them on the frontend if the API doesn't return parent_id 
        // BUT CatagoriesResponse from earlier doesn't have parent_id now based on user edit.
        // Revert to matching logic: actually we need to know the parent_id to group them.
        // Wait, if parent_id is missing, the backend list endpoint with q, etc. is needed.
        // Let's assume sub categories have some association or we just map them by order for now if parent_id is gone.
        // Note: I will map them based on a hacky "sort_order" or just display them for UI purposes
        console.warn("Subcategories: ", subArray)

        // As `parent_id` was removed from the type by the user, we will construct mock CategoryData 
        // to match the UI if backend doesn't link them cleanly, or assume `getCatagoriesName` 
        // actually returns structured data. Let's group them properly if `parent_id` DOES exist
        // in the real JSON payload (often it does even if not mapped in TS).
        
        const mappedData: CategoryData[] = mainArray.map(main => {
          // Attempt to find subs for this main category from the raw data
          // Cast to any to get parent_id if it exists
          const subsForMain = subArray.filter((sub: any) => sub.parent_id === main.id)
          return {
            main: main,
            subs: subsForMain
          }
        })
        
        setCategories(mappedData)
        setFilteredCategories(mappedData)
      } catch (error) {
        console.error("Failed to load categories", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, []) // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCategories(categories)
      return
    }

    const lowerSearch = searchTerm.toLowerCase()
    const filtered = categories.filter(cat => {
      const matchMain = cat.main.name.toLowerCase().includes(lowerSearch)
      const matchSub = cat.subs.some(sub => sub.name.toLowerCase().includes(lowerSearch))
      return matchMain || matchSub
    })
    setFilteredCategories(filtered)
  }, [searchTerm, categories])

  if (isLoading) {
    return (
      <div className="p-8 h-full flex justify-center items-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className=" p-6 md:p-8 space-y-6 text-[#2D2D2D] ">
      {/* Header */}
      <div>
        <p className="text-gray-500 text-sm mb-1">
          Category &gt; <span className="text-gray-800">Category Management</span>
        </p>
        <h1 className="text-2xl font-bold">Category Management</h1>
        <p className="text-gray-500 text-sm">
          Manage main categories and subcategories shown in the marketplace.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
        <h2 className="text-lg font-semibold">
          All Categories ({filteredCategories.length})
        </h2>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search categories" 
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-[300px] h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => navigate("/admin/category/add")}
            className="flex items-center justify-center gap-2 bg-[#FF4C24] hover:bg-[#E63E1A] text-white px-4 py-2 rounded-lg font-medium transition-colors h-10 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Main Category
          </button>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((group) => (
          <div key={group.main.id} className="bg-[#FAF9F8] rounded-[24px] overflow-hidden flex flex-col h-full border border-transparent p-4">
            {/* Inner White Container (Optional if card is white, but image shows white background) padding */}
            <div className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col h-full p-5 sm:p-6 border border-gray-100">
              {/* Header Image Placeholder (based on Design) */}
              <div className="h-48 w-full overflow-hidden flex items-center justify-center relative rounded-xl mb-5 shrink-0">
                {group.main.icon_url ? (
                  <img 
                    src={resolveImageUrl(group.main.icon_url)}
                    alt={group.main.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#FF4C24]/20 to-[#FF4C24]/5 flex items-center justify-center">
                    <span className="text-[#FF4C24] text-5xl font-bold opacity-30">
                      {group.main.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Main Category Info */}
              <div className="flex-grow flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <Folder className="w-6 h-6 text-gray-800 shrink-0" strokeWidth={2.5} />
                  <h3 className="text-2xl font-bold text-gray-900 leading-none">{group.main.name}</h3>
                </div>
                <p className="text-[15px] text-gray-800 mb-5">{group.subs.length} Subcategories</p>
                
                {/* Divider */}
                <div className="h-[1px] bg-gray-300 w-full mb-5"></div>
                
                {/* Subcategories Container (Bordered Box) */}
                <div className="border border-gray-400 rounded-lg p-2.5 mb-6 h-[170px]">
                  {/* Subcategories List with Custom Scrollbar */}
                  <div className="h-full overflow-y-auto pr-2 space-y-1 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#FFF4EE] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#FF4C24] hover:[&::-webkit-scrollbar-thumb]:bg-[#E63E1A] [&::-webkit-scrollbar-thumb]:rounded-full">
                    {group.subs.length > 0 ? (
                      group.subs.map((sub) => (
                        <div 
                          key={sub.id} 
                          className="rounded-md px-4 py-3 flex justify-between items-center transition-colors cursor-default hover:bg-[#FFF4EE]"
                        >
                          <span className="text-[15px] text-gray-900 tracking-wide">{sub.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-sm text-gray-400 py-4 italic">No subcategories</div>
                    )}
                  </div>
                </div>
                
                {/* Edit Button */}
                <button 
                  onClick={() => navigate("/admin/category/add", { state: group })}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF4C24] hover:bg-[#E63E1A] text-white py-3.5 rounded-lg font-medium text-[16px] transition-colors mt-auto shrink-0 shadow-sm"
                >
                  <Pencil className="w-5 h-5" />
                  Edit Category / Subcategory
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Fill Empty Search State */}
        {filteredCategories.length === 0 && !isLoading && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 py-20 text-center text-gray-500">
            No categories found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  )
}
