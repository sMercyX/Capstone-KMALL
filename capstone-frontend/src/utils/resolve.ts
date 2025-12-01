import { API_BASE } from "../config"

export function resolveImageUrl(path?: string | null): string {
  if (!path) {
    return "https://via.placeholder.com/800"
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }

  const url = new URL(API_BASE)

  const origin = url.origin     
  const basePath = url.pathname.replace(/\/api\/?$/, "")  

  return `${origin}${basePath}${path}`
}
