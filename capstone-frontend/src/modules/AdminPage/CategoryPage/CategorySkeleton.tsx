export default function CategorySkeleton() {
  return (
    <div className="bg-[#FAF9F8] rounded-[24px] overflow-hidden flex flex-col h-full border border-transparent p-2.5 animate-pulse">
      <div className="bg-white rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.04)] flex flex-col h-full p-6 border border-gray-100">
        {/* Header Image Placeholder */}
        <div className="mx-auto h-32 w-32 rounded-full bg-gray-100 mb-5 shrink-0" />
        
        {/* Main Category Info Placeholder */}
        <div className="flex-grow flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 truncate flex-1">
              <div className="h-5 bg-gray-100 rounded w-full" />
            </div>
          </div>
          <div className="h-4 bg-gray-50 rounded w-1/2 mb-3" />
          
          {/* Divider */}
          <div className="h-[1px] bg-gray-100 w-full mb-3" />
          
          {/* Subcategories Container Placeholder */}
          <div className="border border-gray-100 rounded-lg p-2 h-[120px] space-y-2">
            <div className="h-6 bg-gray-50 rounded w-full" />
            <div className="h-6 bg-gray-50 rounded w-full" />
            <div className="h-6 bg-gray-50 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
