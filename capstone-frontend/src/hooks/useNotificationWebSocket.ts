import { useEffect, useRef } from 'react'
import type { Notification } from '../api/notificationApi'

const getWsUrl = (path: string) => {
  let baseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
  baseUrl = baseUrl.replace(/\/+$/, "")

  if (baseUrl.startsWith('https')) {
    baseUrl = baseUrl.replace('https', 'wss')
  } else if (baseUrl.startsWith('http')) {
    baseUrl = baseUrl.replace('http', 'ws')
  }

  return `${baseUrl}${path}`
}

type NotificationPayload = {
  type: string
  data: Notification
}

/**
 * Hook that connects to the notification WebSocket for a given user.
 * Calls `onNotification` whenever a new NOTIFICATION message arrives.
 * Automatically reconnects on disconnect with exponential backoff.
 */
export function useNotificationWebSocket(
  userID: string | undefined,
  onNotification: (notification: Notification) => void
) {
  const ws = useRef<WebSocket | null>(null)
  const onNotificationRef = useRef(onNotification)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retryCount = useRef(0)

  useEffect(() => {
    onNotificationRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    if (!userID) return

    function connect() {
      const url = getWsUrl(`/ws/notifications?user_id=${encodeURIComponent(userID!)}`)
      console.log('[WS-Notification] Connecting to:', url)

      const socket = new WebSocket(url)
      ws.current = socket

      socket.onopen = () => {
        console.log('[WS-Notification] Connected')
        retryCount.current = 0
      }

      socket.onmessage = (event) => {
        try {
          const payload: NotificationPayload = JSON.parse(event.data)
          if (payload.type === 'NOTIFICATION') {
            console.log('[WS-Notification] New notification:', payload.data)
            onNotificationRef.current(payload.data)
          }
        } catch (e) {
          console.error('[WS-Notification] Failed to parse message:', e)
        }
      }

      socket.onclose = (event) => {
        // If it was a normal closure or we nullified onclose, don't reconnect
        if (!ws.current) return

        console.log('[WS-Notification] Disconnected', event.reason)
        // Reconnect with exponential backoff (max 30s)
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000)
        retryCount.current++
        reconnectTimeout.current = setTimeout(connect, delay)
      }

      socket.onerror = (error) => {
        // Only log error if not in closing/closed state to avoid StrictMode noise
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          // If we are about to close it intentionally in cleanup, the browser might still fire error
          // We can check if the socket is still the "current" one
          if (ws.current === socket) {
            console.error('[WS-Notification] Error (Handled):', error)
          }
        }
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout.current)
      if (ws.current) {
        ws.current.onclose = null // prevent reconnect on intentional close
        if (
          ws.current.readyState === WebSocket.OPEN ||
          ws.current.readyState === WebSocket.CONNECTING
        ) {
          ws.current.close()
        }
      }
    }
  }, [userID])
}
