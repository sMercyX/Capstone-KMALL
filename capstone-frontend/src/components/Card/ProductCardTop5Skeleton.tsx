// src/components/Card/ProductCardTop5Skeleton.tsx
export default function ProductCardTop5Skeleton() {
  return (
    <div className="flex flex-col w-full max-w-[200px] rounded-lg border border-gray-100 bg-white overflow-hidden animate-pulse">
      {/* Top Badge Placeholder */}
      <div className="absolute top-0 right-0 z-10">
        <div className="bg-gray-200 h-6 w-10 rounded-bl-lg" />
      </div>

      {/* Product Image Area Placeholder */}
      <div className="relative h-44 w-full bg-gray-50 flex items-center justify-center p-2">
        <div className="w-24 h-24 bg-gray-200 rounded-md" />
        
        {/* Units Sold Overlay Placeholder */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-200/50 py-2 px-3">
          <div className="h-2 w-16 bg-gray-300 mx-auto rounded" />
        </div>
      </div>

      {/* Content Section Placeholder */}
      <div className="p-3 flex flex-col gap-2">
        {/* Title */}
        <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
        {/* Store Name */}
        <div className="h-3 w-1/2 bg-gray-100 rounded" />
        {/* Price */}
        <div className="h-5 w-1/3 bg-gray-200 rounded mt-2" />
      </div>
    </div>
  )
}
