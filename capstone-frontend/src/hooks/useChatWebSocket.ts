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
  
  return `${baseUrl}${path}`
}

export type ChatMessagePayload = {
  type: string
  data: {
    message: {
      message_id: number
      thread_id: number
      sender_id: string
      message_text: string
      message_type: string
      created_at: string
      moderation_status: string
    }
    attachments?: {
      attachment_id: number
      file_url: string
      file_name?: string
      mime_type?: string
    }[]
  }
}

export function useChatWebSocket(
  threadId: number | undefined, 
  onNewMessage: (data: ChatMessagePayload['data']) => void
) {
  const ws = useRef<WebSocket | null>(null)
  const onNewMessageRef = useRef(onNewMessage)

  // Update ref when callback changes
  useEffect(() => {
    onNewMessageRef.current = onNewMessage
  }, [onNewMessage])

  useEffect(() => {
    if (!threadId) return

    const url = getWsUrl(`/ws/chats/${threadId}`)
    console.log('[Chat WebSocket] Connecting to:', url)

    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      console.log('[Chat WebSocket] Connected')
    }

    socket.onmessage = (event) => {
      try {
        const payload: ChatMessagePayload = JSON.parse(event.data)
        if (payload.type === 'NEW_MESSAGE') {
          console.log('[Chat WebSocket] New Message Received:', payload.data)
          onNewMessageRef.current(payload.data)
        }
      } catch (e) {
        console.error('[Chat WebSocket] Failed to parse message:', e)
      }
    }

    socket.onclose = () => {
      console.log('[Chat WebSocket] Disconnected')
    }

    socket.onerror = (error) => {
      console.error('[Chat WebSocket] Error:', error)
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
  }, [threadId])
}
