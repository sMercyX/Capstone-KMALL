interface PaginationBackendProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export default function PaginationBackend({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationBackendProps) {
  if (totalPages <= 1) return null

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
      <span>
        {currentPage}/{totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
      >
        ‹
      </button>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
      >
        ›
      </button>
    </div>
  )
}
