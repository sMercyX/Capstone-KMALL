export default function OrderDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 animate-pulse">
      {/* Back Button Skeleton */}
      <div className="h-10 w-24 bg-gray-200 rounded-xl mb-4" />

      {/* Title Skeleton */}
      <div className="text-center mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded-lg mx-auto mb-3" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg mx-auto" />
      </div>

      {/* Stepper Skeleton */}
      <div className="mb-8 flex justify-center">
        <div className="w-full max-w-4xl rounded-3xl bg-white border border-gray-100 px-6 md:px-8 py-8 shadow-sm">
          <div className="flex justify-between items-center relative">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 z-10">
                <div className="h-8 w-8 bg-gray-200 rounded-full" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            ))}
            {/* Connector Line */}
            <div className="absolute top-4 left-0 right-0 h-[2px] bg-gray-100 -z-0" />
          </div>
        </div>
      </div>

      {/* Main Card Skeleton */}
      <div className="rounded-3xl bg-white border border-gray-100 px-6 md:px-8 py-8 shadow-sm">
        {/* Status Banner Skeleton */}
        <div className="h-20 bg-gray-100 rounded-2xl mb-8" />

        {/* Store/Buyer Info Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-gray-200 rounded-full" />
            <div>
              <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-10 w-28 bg-gray-200 rounded-xl" />
        </div>

        {/* Content Section Skeleton */}
        <div className="space-y-8">
          {/* Section 1 */}
          <div>
            <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-16 bg-gray-50 rounded-xl" />
              <div className="h-16 bg-gray-50 rounded-xl" />
            </div>
          </div>

          {/* Product List Skeleton */}
          <div>
            <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="h-16 w-16 bg-gray-200 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-1/4 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Skeleton */}
          <div className="pt-6 border-t border-gray-50 flex flex-col items-end gap-3">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-6 w-40 bg-gray-200 rounded mt-2" />
          </div>
        </div>
      </div>
    </div>
  )
}
