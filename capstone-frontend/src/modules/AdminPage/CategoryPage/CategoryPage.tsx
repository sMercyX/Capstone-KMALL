import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { useCatagoriesApi, type CatagoriesResponse } from "../../../api/catagoriesApi"
import { resolveImageUrl } from "../../../utils/resolve"
import SearchInput from "../../../components/Input/SearchInput"
import CategorySkeleton from "./CategorySkeleton"

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
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    async function loadData() {
      setIsSearching(true)
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
        setIsSearching(false)
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermDebounced])

  return (
    <div className="h-full flex flex-col text-[#2D2D2D] overflow-hidden">
      {/* Fixed Top Section (Header & Controls) */}
      <div className="shrink-0 space-y-6 pb-6 border-b border-gray-200/50">
        {/* Header */}
        <div>
          <p className="text-gray-400 text-description mb-1">
            Admin &gt; <span className="text-gray-600 font-semibold">Category Management</span>
          </p>
          <h1 className="text-header font-bold">Category Management</h1>
          <p className="text-gray-500 text-description">
            Manage main categories and subcategories shown in the marketplace.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
          <h2 className="text-text font-semibold">
            All Categories ({categories.length})
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <SearchInput
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value
                setSearchTerm(val)
                setIsSearching(true) // Set searching state immediately
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
                debounceTimerRef.current = setTimeout(() => {
                  setSearchTermDebounced(val)
                }, 400)
              }}
              placeholder="Search categories"
              isSearching={isSearching}
            />
            
            <button 
              onClick={() => navigate("/admin/category/add")}
              className="flex text-description items-center justify-center gap-2 bg-[#FF4C24] hover:bg-[#E63E1A] text-white px-4 py-2 rounded-lg font-medium transition-colors h-10 w-full sm:w-auto shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Main Category
            </button>
          </div>
        </div>
      </div>

      {/* Category Grid (Scrollable) */}
      <div className="flex-1 overflow-y-auto mt-6 pr-2 -mr-2 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#F1F1F1] [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-[#D1D1D1] hover:[&::-webkit-scrollbar-thumb]:bg-[#B1B1B1] [&::-webkit-scrollbar-thumb]:rounded-lg">
        <div className={`grid gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] pb-8`}>
          {isSearching
            ? Array.from({ length: 8 }).map((_, i) => (
                <CategorySkeleton key={i} />
              ))
            : categories.map((group) => (
                <div key={group.main.id} className="bg-[#FAF9F8] rounded-lg overflow-hidden flex flex-col h-full border border-transparent p-2.5 ">
                  {/* Inner White Container */}
                  <div onClick={() => navigate(`/admin/category/edit/${group.main.slug}`)} className="bg-white cursor-pointer duration-200 hover:scale-[1.03] hover:shadow-xl rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.04)] flex flex-col h-full p-6 border border-gray-100">
                    {/* Header Image Placeholder */}
                    <div className="mx-auto h-32 w-32 rounded-full bg-orange-50 grid place-items-center overflow-hidden mb-5 border-2 border-orange-100/50 shrink-0">
                      {group.main.icon_url ? (
                        <img 
                          src={resolveImageUrl(group.main.icon_url)}
                          alt={group.main.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#FF4C24]/20 to-[#FF4C24]/5 flex items-center justify-center">
                          <span className="text-[#FF4C24] text-5xl font-bold opacity-30 tracking-tight">
                            {group.main.name.charAt(0).toUpperCase()} 
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Main Category Info */}
                    <div className="flex-grow flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 truncate">
                          <h3 className="text-text font-bold text-gray-900 leading-tight truncate">{group.main.name}</h3>
                        </div>
                      </div>
                      <p className="text-description mb-3">{group.main.sub_category_count ?? group.subs.length} Subcategories</p>
                      
                      {/* Divider */}
                      <div className="h-[1px] bg-gray-200 w-full mb-3"></div>
                      
                      {/* Subcategories Container (Bordered Box) */}
                      <div className="border border-gray-300 rounded-lg p-2 h-[120px]">
                        {/* Subcategories List with Custom Scrollbar */}
                        <div className="h-full overflow-y-auto pr-1 space-y-0.5 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-[#FFF4EE] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#FF4C24] hover:[&::-webkit-scrollbar-thumb]:bg-[#E63E1A] [&::-webkit-scrollbar-thumb]:rounded-full">
                          {group.subs.length > 0 ? (
                            group.subs.map((sub) => (
                              <div 
                                key={sub.id} 
                                className="rounded-md px-2 py-1.5 flex justify-between items-center transition-colors cursor-default hover:bg-[#FFF4EE]"
                              >
                                <span className="text-description tracking-wide truncate pr-2">{sub.name}</span>
                                {sub.product_count !== undefined && (
                                  <span className="text-[11px] font-medium text-[#FF4C24] shrink-0">{sub.product_count} Products</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center text-[11px] text-gray-400 py-4 italic">No subcategories</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          
          {/* Fill Empty Search State */}
          {categories.length === 0 && !isSearching && (
            <div className="col-span-full py-20 text-center text-gray-500">
              No categories found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
