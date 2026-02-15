// src/components/NavBar/SearchBar.tsx
import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useSearchApi } from "../../api/searchApi"
import type { SearchHistoryItem } from "../../api/searchApi"

export default function SearchBar() {
  const [query, setQuery] = useState("")
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [matchingHistory, setMatchingHistory] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  
  const { 
    getSearchHistory, 
    deleteSearchHistoryItem, 
    clearSearchHistory, 
    getSuggestions 
  } = useSearchApi()

  // Sync query from URL parameter
  useEffect(() => {
    // If not on search page, clear query
    if (location.pathname !== '/search') {
      setQuery("")
      return
    }

    const params = new URLSearchParams(location.search)
    const q = params.get("q")
    if (q) {
      setQuery(q)
    }
  }, [location.pathname, location.search])

  // Fetch search history from API
  const fetchSearchHistory = async () => {
    setIsHistoryLoading(true)
    try {
      const res = await getSearchHistory()
      setSearchHistory(res.data?.items || [])
    } catch (err) {
      console.error("Failed to fetch search history:", err)
      setSearchHistory([])
    } finally {
      setIsHistoryLoading(false)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch history when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchSearchHistory()
    }
  }, [isOpen])

  // Fetch suggestions (and matching history) when query changes
  useEffect(() => {
    if (!query.trim()) {
      setMatchingHistory([])
      setSuggestions([])
      return
    }

    // Debounced fetch suggestions
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await getSuggestions(query)
        setSuggestions(res.data?.suggest || [])
        setMatchingHistory(res.data?.history || [])
      } catch (err) {
        console.error("Search failed:", err)
        setSuggestions([])
        setMatchingHistory([])
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query])

  const handleSearch = (searchTerm?: string) => {
    const term = searchTerm || query
    setQuery(term)
    navigate(`/search?q=${encodeURIComponent(term.trim())}`)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleHistoryClick = (term: string) => {
    handleSearch(term)
  }

  const handleClearAllHistory = async () => {
    try {
      await clearSearchHistory()
      setSearchHistory([])
      setMatchingHistory([])
    } catch (err) {
      console.error("Failed to clear search history:", err)
    }
  }

  const handleDeleteHistoryItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteSearchHistoryItem(id)
      setSearchHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      console.error("Failed to delete history item:", err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
  }

  // Highlight matching text in orange
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>
    
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)
    
    if (index === -1) return <span>{text}</span>
    
    const before = text.slice(0, index)
    const match = text.slice(index, index + query.length)
    const after = text.slice(index + query.length)
    
    return (
      <>
        <span>{before}</span>
        <span className="text-orange-500">{match}</span>
        <span>{after}</span>
      </>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-[70%]">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={128}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search for products and stores..."

          className="w-full rounded-full border border-gray-300 pl-4 pr-12 py-2 
                     focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                     transition-all duration-200 bg-white text-gray-700 placeholder-gray-400"
        />
        <button 
          onClick={() => handleSearch()}
          className="absolute right-1 top-1/2 -translate-y-1/2 
                     bg-white hover:bg-orange-50 text-gray-500 hover:text-orange-500
                     p-2 rounded-full transition-colors duration-200"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
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
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl 
                        shadow-xl border border-gray-100 overflow-hidden z-50">
          
          {/* Loading indicator */}
          {(isLoading || isHistoryLoading) && (
            <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div>
              Loading...
            </div>
          )}

          {/* Search History - when no query */}
          {!query.trim() && !isHistoryLoading && (
            <div>
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <span className="text-sm text-gray-500">Your search history</span>
                {searchHistory.length > 0 && (
                  <button
                    onClick={handleClearAllHistory}
                    className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    Clear search history
                  </button>
                )}
              </div>

              {/* History Items */}
              {searchHistory.length > 0 ? (
                searchHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleHistoryClick(item.query_text)}
                    className="group px-4 py-3 flex items-center justify-between cursor-pointer 
                               hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3">
                      {/* Clock icon */}
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 text-gray-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      <span className="text-gray-700">{item.query_text}</span>
                    </div>
                    
                    {/* Arrow icon - hidden on hover */}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 text-gray-400 group-hover:hidden" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M7 17l9.2-9.2M17 17V8H8" 
                      />
                    </svg>

                    {/* Delete (X) icon - shown on hover */}
                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="hidden group-hover:block p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove this item"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M6 18L18 6M6 6l12 12" 
                        />
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-gray-400">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-10 w-10 mx-auto mb-2 text-gray-300" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <p>No search history yet.</p>
                </div>
              )}
            </div>
          )}

          {/* When there's a query - show matching history + suggestions */}
          {query.trim() && !isLoading && (
            <div>
              {/* Matching History Items (max 4) */}
              {matchingHistory.map((item, index) => (
                <div
                  key={`history-${index}`}
                  onClick={() => handleHistoryClick(item)}
                  className="px-4 py-3 flex items-center justify-between cursor-pointer 
                             hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    {/* Clock icon */}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 text-gray-400 flex-shrink-0" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-gray-700">
                      {highlightMatch(item, query)}
                    </span>
                  </div>
                  {/* Arrow icon */}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 text-gray-400 flex-shrink-0" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 17l9.2-9.2M17 17V8H8" 
                    />
                  </svg>
                </div>
              ))}

              {/* Suggestions from API */}
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSearch(suggestion)}
                  className="px-4 py-3 flex items-center justify-between cursor-pointer 
                             hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    {/* Search icon */}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 text-gray-400 flex-shrink-0" 
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
                    <span className="text-gray-700">
                      {highlightMatch(suggestion, query)}
                    </span>
                  </div>
                  {/* Arrow icon */}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 text-gray-400 flex-shrink-0" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 17l9.2-9.2M17 17V8H8" 
                    />
                  </svg>
                </div>
              ))}

              {/* No results */}
              {matchingHistory.length === 0 && suggestions.length === 0 && (
                <div className="px-4 py-20 text-left">
                  <p className="text-gray-700 mb-2">We couldn’t find any matches. Try these tips:</p>
                  <ul className="list-disc list-inside text-gray-500 text-sm ml-2">
                    <li>Check your spelling</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
