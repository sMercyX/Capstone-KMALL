import { useEffect, useRef } from 'react'

const getWsUrl = (path: string) => {
  // Try to get base URL from environment or fallback
  let baseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
  
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/+$/, "")

  // Replace protocol
  if (baseUrl.startsWith('https')) {
    baseUrl = baseUrl.replace('https', 'wss')
  } else if (baseUrl.startsWith('http')) {
    baseUrl = baseUrl.replace('http', 'ws')
  }

  // Allow passing absolute path or relative
  // Our backend expects /api/ws/orders/:orderId
  // The path argument should be the full suffix e.g. /api/ws/orders/123
  
  return `${baseUrl}${path}`
}

type OrderUpdatePayload = {
  type: string
  data: any
}

export function useOrderWebSocket(orderId: string | undefined, onUpdate: (data: any) => void) {
  const ws = useRef<WebSocket | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep ref in sync with latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!orderId) return

    const url = getWsUrl(`/ws/orders/${orderId}`)
    console.log('[WebSocket] Connecting to:', url)

    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      console.log('[WebSocket] Connected')
    }

    socket.onmessage = (event) => {
      try {
        const payload: OrderUpdatePayload = JSON.parse(event.data)
        if (payload.type === 'ORDER_UPDATE') {
          console.log('[WebSocket] Order Update Received:', payload.data)
          if (onUpdateRef.current) {
            onUpdateRef.current(payload.data)
          }
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse message:', e)
      }
    }

    socket.onclose = () => {
      console.log('[WebSocket] Disconnected')
    }

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
  }, [orderId]) // Dependency is ONLY orderId now, not onUpdate
}
