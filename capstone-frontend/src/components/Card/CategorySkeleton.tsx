// src/components/Card/CategorySkeleton.tsx
export default function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-w-[140px] h-[140px] sm:min-w-[160px] sm:h-[160px] rounded-lg border border-gray-100 bg-white animate-pulse my-2">
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gray-100 mb-3" />
      <div className="h-4 w-20 bg-gray-100 rounded" />
    </div>
  )
}
