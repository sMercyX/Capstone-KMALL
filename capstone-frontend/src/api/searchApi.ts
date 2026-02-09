import { useCrudApi } from "../utils/fetch"

export interface SearchHistoryItem {
  id: number
  user_id: string
  query_text: string
  searched_at: string
}

export interface SearchHistoryResponse {
  code: number
  data: {
    items: SearchHistoryItem[]
  }
  status: string
}

export interface SuggestResponse {
  code: number
  data: {
    history: string[]
    suggest: string[]
  }
  status: string
}

export function useSearchApi() {
  const http = useCrudApi()

  async function getSearchHistory(limit: number = 20, page: number = 1): Promise<SearchHistoryResponse> {
    return http.getItems(`/search-history?limit=${limit}&page=${page}`)
  }

  async function deleteSearchHistoryItem(id: number) {
    return http.deleteItem(`/search-history/${id}`)
  }
  
  async function clearSearchHistory() {
    return http.deleteItem(`/search-history`)
  }

  async function getSuggestions(query: string): Promise<SuggestResponse> {
    return http.getItems(`/products/suggest?q=${encodeURIComponent(query)}`)
  }

  return {
    getSearchHistory,
    deleteSearchHistoryItem,
    clearSearchHistory,
    getSuggestions
  }
}
