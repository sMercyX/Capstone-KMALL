import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, Folder, Pencil, Loader2 } from "lucide-react"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import LoadingSpinner from "../../../components/LoaingSpinner/LoadingSpinner"
import { resolveImageUrl } from "../../../utils/resolve"

interface CategoryData {
  main: CatagoriesResponse
  subs: CatagoriesResponse[]
}

export default function CategoryPage() {
  const navigate = useNavigate()
  const { getAdminCategories } = useCatagoriesApi()
  
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [searchTermDebounced, setSearchTermDebounced] = useState("")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setSearchTermDebounced(val)
    }, 400)
  }

  useEffect(() => {
    async function loadData() {
      setIsSearching(true)
      // Only set isInitialLoading to true if it's the very first load (i.e., it's currently true)
      // This prevents the full-page spinner from showing again on subsequent searches.
      if (isInitialLoading) { 
        setIsInitialLoading(true)
      }
      try {
        const res = await getAdminCategories({ ...(searchTermDebounced ? { q: searchTermDebounced } : {}) })
        const allArray = res.data || []
        
        const mainArray = allArray.filter(cat => !cat.parent_id || cat.parent_id === 0)
        const subArray = allArray.filter(cat => cat.parent_id && cat.parent_id !== 0)

        const mappedData: CategoryData[] = mainArray.map(main => {
          const subsForMain = subArray.filter((sub: any) => sub.parent_id === main.id)
          return {
            main: main,
            subs: subsForMain
          }
        })
        
        setCategories(mappedData)
      } catch (error) {
        console.error("Failed to load categories", error)
      } finally {
        setIsInitialLoading(false)
        setIsSearching(false)
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermDebounced])

  if (isInitialLoading) {
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
          All Categories ({categories.length})
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            {isSearching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500 animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            )}
            <input 
              type="text" 
              placeholder="Search categories" 
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-[300px] h-10"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <button 
            onClick={() => navigate("/admin/category/add")}
            className="flex items-center justify-center gap-2 bg-[#FF4C24] hover:bg-[#E63E1A] text-white px-4 py-2 rounded-lg font-medium transition-colors h-10 w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Main Category
          </button>
        </div>
      </div>

      {/* Category Grid */}
      <div className={`grid gap-6 transition-opacity duration-200 ${isSearching && !isInitialLoading ? 'opacity-50' : 'opacity-100'} grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))]`}>
        {categories.map((group) => (
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
                          {sub.product_count !== undefined && (
                            <span className="text-[13px] font-medium text-[#FF4C24] leading-none flex items-center">{sub.product_count} Products</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-sm text-gray-400 py-4 italic">No subcategories</div>
                    )}
                  </div>
                </div>
                
                {/* Edit Button */}
                <button 
                  onClick={() => navigate(`/admin/category/edit/${group.main.slug}`)}
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
        {categories.length === 0 && !isSearching && !isInitialLoading && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 py-20 text-center text-gray-500">
            No categories found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  )
}
