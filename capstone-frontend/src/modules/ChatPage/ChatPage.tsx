import React, { useState, useRef, useEffect } from "react"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { Send, Plus, MessageCircle, User, ChevronLeft } from "lucide-react"
import { useChatApi, type MessageWithAttachments, type ChatThread } from "../../api/chatApi"
import { useUserStore } from "../../stores/userStore"
import { handleApiError } from "../../utils/handleApiError"
import { resolveImageUrl } from "../../utils/resolve"

// Types for UI messages
type DisplayMessage = {
  id: string
  text: string
  sender: "user" | "seller"
  timestamp: string
  isRead?: boolean
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
  const transformMessages = (apiMessages: MessageWithAttachments[], myUserId: string): DisplayMessage[] => {
    // Sort messages by created_at ascending (oldest first)
    const sortedMessages = [...apiMessages].sort((a, b) => 
      new Date(a.message.created_at).getTime() - new Date(b.message.created_at).getTime()
    )
    
    return sortedMessages.map((item) => {
      const msg = item.message
      const createdAt = new Date(msg.created_at)
      
      // Check if this message was sent by me
      const isMyMessage = msg.sender_id === myUserId
      
      return {
        id: msg.message_id.toString(),
        text: msg.message_text,
        sender: isMyMessage ? "user" : "seller",
        timestamp: createdAt.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        attachments: item.attachments?.map(att => ({
          file_url: att.file_url,
          file_name: att.file_name,
          mime_type: att.mime_type,
        })),
      }
    })
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
        setThread(threadData)
        
        // Fetch messages
        const messagesRes = await getMessages(threadData.thread_id)
        
        console.log("=== Chat Debug ===")
        console.log("userId:", userId)
        
        const displayMessages = transformMessages(
          messagesRes.data.messages || [],
          userId
        )
        setMessages(displayMessages)
      } catch (e) {
        handleApiError(e)
      } finally {
        setLoading(false)
      }
    }
    
    loadChatData()
  }, [orderId, userId])

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
      const res = await sendMessage(thread.thread_id, inputText, attachments)
      
      // Add new message to display
      const newMsg = res.data.message
      const createdAt = new Date(newMsg.created_at)
      
      const displayMsg: DisplayMessage = {
        id: newMsg.message_id.toString(),
        text: newMsg.message_text,
        sender: "user",
        timestamp: createdAt.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        attachments: res.data.attachments?.map(att => ({
          file_url: att.file_url,
          file_name: att.file_name,
          mime_type: att.mime_type,
        })),
      }
      
      setMessages(prev => [...prev, displayMsg])
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
              <span>{isSeller ? "แชทกับลูกค้า" : "แชทกับผู้ขาย"}</span>
            </div>
            <p className="text-base font-bold text-gray-800">Order : #{orderId || "1111"}</p>
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
                <p className="text-gray-400">กำลังโหลดข้อความ...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Date Divider */}
                <div className="relative flex justify-center">
                  <span className="rounded-[4px] bg-white px-3 py-1 text-xs text-gray-400 shadow-sm border border-gray-100">
                    วันนี้
                  </span>
                </div>

                {messages.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-gray-400">ยังไม่มีข้อความ</p>
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
                                className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-gray-200"
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
                          className={`flex items-center gap-1 text-xs px-2 ${
                            msg.sender === "user" ? "text-gray-400 justify-end" : "text-gray-400 justify-start"
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          {msg.sender === "user" && msg.isRead && (
                            <span className="text-[#4CAF50]">✓✓</span>
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
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setSelectedImage(file)
                    setImagePreview(URL.createObjectURL(file))
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
                  placeholder="พิมพ์ข้อความ..."
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