// src/hooks/useCrudApi.ts
export function useHttpClient(baseUrl: string) {
  async function fetchData(path: string, options: RequestInit = {}) {
    try {
      const url = new URL(path, baseUrl)
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        return await response.json()
      }
      return response.text()
    } catch (error) {
      console.error("Fetch error:", error)
      throw error
    }
  }

  const getItems = async (url: string) => {
    return fetchData(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  const postItem = async (url: string, item: {}) => {
    return fetchData(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item),
    })
  }

  return {
    getItems,
    postItem,
  }
}

export function useCrudApi() {
  const baseUrl =
    (import.meta as any)?.env?.VITE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || ""
  return useHttpClient(baseUrl)
}
