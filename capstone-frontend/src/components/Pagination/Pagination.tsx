import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  const getPages = () => {
    const delta = 1; // Number of pages to show around current page
    const range = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const pages = getPages();

  return (
    <div className={`flex justify-center mt-6 ${className}`}>
      <div className="inline-flex items-center gap-1 rounded-full bg-white shadow-md px-3 py-1 border border-gray-100">
        {/* prev */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-full text-sm disabled:opacity-40 hover:bg-gray-100 text-black transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === "number" && goToPage(page)}
            disabled={typeof page !== "number"}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all
              ${
                page === currentPage
                  ? "bg-orange-500 text-white font-medium shadow-sm"
                  : typeof page === "number"
                  ? "text-gray-700 hover:bg-gray-100"
                  : "text-gray-400 cursor-default"
              }`}
          >
            {page}
          </button>
        ))}

        {/* next */}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-full text-sm disabled:opacity-40 hover:bg-gray-100 text-black transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
