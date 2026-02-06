import React, { useState, useRef, useEffect } from "react"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { Send, Plus, MessageCircle, User, ChevronLeft } from "lucide-react"

// Types for chat messages
type Message = {
  id: string
  text: string
  sender: "user" | "seller"
  timestamp: string
  isRead?: boolean
}

// Mock initial data based on the requirements
const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    text: "ได้ค่ะ",
    sender: "seller",
    timestamp: "15:22",
  },
  {
    id: "2",
    text: "เปลี่ยนเวลาเป็น 16:00 ได้ไหมค่ะ",
    sender: "user",
    timestamp: "08:30",
    isRead: true,
  },
]

export default function ChatPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isSeller = location.pathname.includes("/store/")
  
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: isSeller ? "seller" : "user",
      timestamp: new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      isRead: false,
    }

    setMessages([...messages, newMessage])
    setInputText("")
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
          <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
             <div className="space-y-6">
              {/* Date Divider */}
              <div className="relative flex justify-center">
                <span className="rounded-[4px] bg-white px-3 py-1 text-xs text-gray-400 shadow-sm border border-gray-100">
                  วันนี้
                </span>
              </div>

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
                  className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm outline-none focus:border-gray-300 focus:ring-0 transition-all placeholder:text-gray-300 shadow-inner"
                />
                 <button
                  type="submit"
                  disabled={!inputText.trim()}
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