import React, { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { Send, Plus, MessageCircle, User, ChevronLeft, Check, CheckCheck } from "lucide-react"
import { useChatApi, type MessageWithAttachments, type ChatThread } from "../../api/chatApi"
import { useUserStore } from "../../stores/userStore"
import { handleApiError } from "../../utils/handleApiError"
import { resolveImageUrl } from "../../utils/resolve"
import { useChatWebSocket, type ChatMessagePayload } from "../../hooks/useChatWebSocket"
import { toast } from "react-toastify"

// Types for UI messages
type DisplayMessage = {
  id: string
  text: string
  sender: "user" | "seller"
  timestamp: string
  isRead: boolean
  isLastRead: boolean
  attachments?: {
    file_url: string
    file_name: string
    mime_type: string
  }[]
}

export default function ChatPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isSeller = location.pathname.includes("/store/")
  
  const { openThread, getMessages, sendMessage } = useChatApi()
  const { id: userId } = useUserStore()
  
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasFetched = useRef(false)

  // Transform API messages to display format
  const transformMessages = (
    apiMessages: MessageWithAttachments[], 
    myUserId: string,
    otherLastReadId: number = 0
  ): DisplayMessage[] => {
    // Sort messages by created_at ascending (oldest first)
    const sortedMessages = [...apiMessages].sort((a, b) => 
      new Date(a.message.created_at).getTime() - new Date(b.message.created_at).getTime()
    )
    
    return sortedMessages.map((item) => {
      const msg = item.message
      const createdAt = new Date(msg.created_at)
      
      // Check if this message was sent by me
      const isMyMessage = msg.sender_id === myUserId
      
      // Check read status
      const isRead = msg.message_id <= otherLastReadId
      // Check if this is explicitly the last read message
      const isLastRead = msg.message_id === otherLastReadId
      
      return {
        id: msg.message_id.toString(),
        text: msg.message_text,
        sender: isMyMessage ? "user" : "seller",
        timestamp: createdAt.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        isRead,
        isLastRead,
        attachments: item.attachments?.map(att => ({
          file_url: att.file_url,
          file_name: att.file_name,
          mime_type: att.mime_type,
        })),
      }
    })
  }

  // Mark all unread messages as read
  const markThreadAsRead = async (threadId: number, messages: MessageWithAttachments[], myUserId: string) => {
    // Find last message sent by OTHER person
    const otherMessages = messages.filter(m => m.message.sender_id !== myUserId)
    if (otherMessages.length === 0) return

    // Find the message with the highest ID (latest message)
    const lastMsgId = Math.max(...otherMessages.map(m => m.message.message_id))
    
    try {
      await useChatApi().markAsRead(threadId, lastMsgId)
    } catch (e) {
      console.error("Failed to mark as read:", e)
    }
  }

  // Load thread and messages on mount
  useEffect(() => {
    if (hasFetched.current) return
    if (!userId) return // Wait for userId to be available
    hasFetched.current = true
    
    const loadChatData = async () => {
      if (!orderId) return
      
      setLoading(true)
      try {
        // Open or get existing thread
        const threadRes = await openThread(parseInt(orderId))
        const threadData = threadRes.data.thread
        
        // Access control: check if user is on correct path
        // - /store/orders/:id/chat → only seller can access
        // - /orders/:id/chat → only buyer can access
        const isSellerInThread = threadData.seller_id === userId
        const isBuyerInThread = threadData.buyer_id === userId
        
        if (isSeller && !isSellerInThread) {
          toast.error("คุณไม่มีสิทธิ์เข้าถึงแชทนี้ (เฉพาะผู้ขาย)")
          navigate("/dashboard")
          return
        }
        if (!isSeller && !isBuyerInThread) {
          toast.error("คุณไม่มีสิทธิ์เข้าถึงแชทนี้ (เฉพาะผู้ซื้อ)")
          navigate("/dashboard")
          return
        }
        
        setThread(threadData)
        
        // Fetch messages
        const messagesRes = await getMessages(threadData.thread_id)
        
        // Find last read message ID for the OTHER person
        // The API returns read_state.other.last_read_message_id
        // NOTE: The API structure provided in request shows:
        // read_state: { me: { ... }, other: { ... } }
        // We need to use read_state.other.last_read_message_id
        const readState = messagesRes.data.read_state
        const otherLastReadId = readState?.other?.last_read_message_id || 0
        
        const displayMessages = transformMessages(
          messagesRes.data.messages || [],
          userId,
          otherLastReadId
        )
        setMessages(displayMessages)
        
        // Mark as read immediately when loading
        markThreadAsRead(threadData.thread_id, messagesRes.data.messages || [], userId)
      } catch (e) {
        handleApiError(e)
      } finally {
        setLoading(false)
      }
    }
    
    loadChatData()
  }, [orderId, userId, isSeller, navigate])

  // Handler for new messages from WebSocket
  const handleNewMessage = useCallback((data: ChatMessagePayload['data']) => {
    const msg = data.message
    const createdAt = new Date(msg.created_at)
    const isMyMessage = msg.sender_id === userId
    
    const newDisplayMessage: DisplayMessage = {
      id: msg.message_id.toString(),
      text: msg.message_text,
      sender: isMyMessage ? "user" : "seller",
      timestamp: createdAt.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      isRead: false, 
      isLastRead: false,
      attachments: data.attachments?.map(att => ({
        file_url: att.file_url,
        file_name: att.file_name || "",
        mime_type: att.mime_type || "",
      })),
    }
    
    // Only add if not already in the list (avoid duplicates from own sends)
    setMessages(prev => {
      if (prev.some(m => m.id === newDisplayMessage.id)) {
        return prev
      }
      return [...prev, newDisplayMessage]
    })
    
    // If not my message, mark as read immediately
    if (!isMyMessage && thread) {
      // Create a minimal MessageWithAttachments object to pass to markThreadAsRead
      const msgObj: MessageWithAttachments = {
        message: msg as any, // minimal cast
        attachments: []
      }
      markThreadAsRead(thread.thread_id, [msgObj], userId)
    }
  }, [userId, thread])

  // Handler for read status updates
  const handleReadUpdate = useCallback((data: any) => {
    // Only care if the update is from the OTHER user
    if (data.user_id === userId) return

    const lastReadId = data.last_read_message_id

    setMessages(prev => prev.map(msg => {
      const msgId = parseInt(msg.id)
      const isRead = msgId <= lastReadId
      const isLastRead = msgId === lastReadId
      
      // Optimization: only return new object if something changed
      if (msg.isRead === isRead && msg.isLastRead === isLastRead) {
        return msg
      }
      
      return {
        ...msg,
        isRead,
        isLastRead
      }
    }))
  }, [userId])

  // WebSocket for real-time updates
  useChatWebSocket(thread?.thread_id, handleNewMessage, handleReadUpdate)

  // Auto-scroll to bottom (within container only)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim() && !selectedImage) return
    if (!thread) return

    setSending(true)
    try {
      const attachments = selectedImage ? [selectedImage] : undefined
      await sendMessage(thread.thread_id, inputText, attachments)
      
      // Message will be added via WebSocket broadcast
      setInputText("")
      setSelectedImage(null)
      setImagePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (e) {
      handleApiError(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[calc(100%-110px)] py-8">
        
        {/* Top Header Section (Outside Box) */}
        <div className="relative mb-6 text-center">
          <button 
            type="button" 
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1 rounded-full p-2 text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2 text-2xl font-semibold text-gray-800">
              <MessageCircle className="h-7 w-7" />
              <span>{isSeller ? "Chat with Customer" : "Chat with Seller"}</span>
            </div>
            <p className="text-base font-bold text-gray-800">Order: #{orderId || "1111"}</p>
          </div>
        </div>

        {/* Chat Box Container */}
        <div className="mx-auto max-w-[800px] h-[750px] flex flex-col rounded-[16px] border border-gray-200 bg-[#f9fafb] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          
          {/* Chat Messages Area */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Loading messages...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Date Divider */}
                <div className="relative flex justify-center">
                  <span className="rounded-[4px] bg-white px-3 py-1 text-xs text-gray-400 shadow-sm border border-gray-100">
                    Today
                  </span>
                </div>

                {messages.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-gray-400">No messages yet</p>
                  </div>
                )}

                {/* Messages */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex items-start gap-3 ${
                        msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 overflow-hidden">
                        {msg.sender === "seller" ? (
                          <img 
                            src="https://via.placeholder.com/48" 
                            alt="Seller" 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-7 w-7 text-gray-400" strokeWidth={1.5} />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className="flex flex-col gap-1">
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.attachments.map((att, idx) => (
                              <img
                                key={idx}
                                src={resolveImageUrl(att.file_url)}
                                alt={att.file_name}
                                className="block max-w-[200px] max-h-[200px] w-auto h-auto rounded-lg object-cover border border-gray-200 bg-gray-50"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/200x200?text=File"
                                  e.currentTarget.onerror = null // prevent loop
                                }}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Text */}
                        {msg.text && (
                          <div
                            className={`px-4 py-2.5 ${
                              msg.sender === "user"
                                ? "bg-[#4CAF50] text-white rounded-[18px]"
                                : "bg-white text-gray-700 rounded-[18px] border border-gray-100"
                            }`}
                          >
                            <span className="text-base leading-relaxed">
                              {msg.text}
                            </span>
                          </div>
                        )}
                        
                        <div 
                          className={`flex items-center gap-1 text-[10px] px-1 mt-0.5 ${
                            msg.sender === "user" ? "text-gray-400 justify-end" : "text-gray-400 justify-start"
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          {msg.sender === "user" && (
                            // Logic: 
                            // - If isLastRead -> Double Tick (Green)
                            // - If !isRead -> Single Tick (Gray)
                            // - If isRead but !isLastRead -> No Tick (Hidden)
                            msg.isLastRead ? (
                              <CheckCheck className="h-3 w-3 text-green-500" />
                            ) : msg.isRead ? (
                               null 
                            ) : (
                              <Check className="h-3 w-3 text-gray-400" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-white p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/heic, image/heif, .heic, .heif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Check for HEIC
                    if (
                      file.type === "image/heic" || 
                      file.type === "image/heif" || 
                      file.name.toLowerCase().endsWith(".heic") ||
                      file.name.toLowerCase().endsWith(".heif")
                    ) {
                      try {
                        const heic2any = (await import("heic2any")).default
                        const convertedBlob = await heic2any({
                          blob: file,
                          toType: "image/jpeg",
                          quality: 0.8
                        })
                        
                        // normalize: convertedBlob can be Blob or Blob[]
                        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
                        
                        const newFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
                          type: "image/jpeg"
                        })
                        
                        setSelectedImage(newFile)
                        setImagePreview(URL.createObjectURL(newFile))
                      } catch (err) {
                        console.error("HEIC conversion failed:", err)
                        toast.error("Failed to process HEIC image")
                      }
                    } else {
                      setSelectedImage(file)
                      setImagePreview(URL.createObjectURL(file))
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              >
                <Plus className="h-6 w-6" strokeWidth={1.5} />
              </button>
              
              {/* Image Preview */}
              {imagePreview && (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-10 w-10 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null)
                      setImagePreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}

              <form onSubmit={handleSend} className="flex flex-1 items-center gap-3 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  disabled={sending || loading}
                  className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm outline-none focus:border-gray-300 focus:ring-0 transition-all placeholder:text-gray-300 shadow-inner disabled:bg-gray-50"
                />
                 <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedImage) || sending}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-6 w-6 rotate-45" strokeWidth={1.5} />
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}