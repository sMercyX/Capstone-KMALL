interface SearchPageHeaderProps {
  query: string
}

export default function SearchPageHeader({ query }: SearchPageHeaderProps) {
  return (
    <header className="flex items-center space-x-2">
      {/* Search Icon */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-8 w-8 text-gray-600" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
        />
      </svg>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
        <span className="text-gray-600">Search results for </span>
        <span className="text-orange-500">'{query}'</span>
      </h1>
    </header>
  )
}
