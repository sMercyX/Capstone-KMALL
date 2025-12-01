import { useEffect, useState } from "react"
import { Info, Upload, X } from "lucide-react"

export type StoreEditForm = {
  name: string
  description: string
  profile_url: string
}

interface StoreEditModalProps {
  isOpen: boolean
  initialName: string
  initialDescription: string
  initialProfileUrl: string
  onClose: () => void
  onSubmit: (data: StoreEditForm) => void | Promise<void>
}

export default function StoreEditModal({
  isOpen,
  initialName,
  initialDescription,
  initialProfileUrl,
  onClose,
  onSubmit,
}: StoreEditModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [fileName, setFileName] = useState("ยังไม่ได้เลือกไฟล์")

  // lock scroll ตอน modal เปิด
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // sync ค่าเริ่มต้น
  useEffect(() => {
    if (!isOpen) return
    setName(initialName || "")
    setDescription(initialDescription || "")
    setProfileUrl(initialProfileUrl || "")
    setFileName(initialProfileUrl || "ยังไม่ได้เลือกไฟล์")
  }, [isOpen, initialName, initialDescription, initialProfileUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      // TODO: เปลี่ยนเป็น URL จากระบบอัปโหลด
      setProfileUrl(file.name)
    } else {
      setFileName("ยังไม่ได้เลือกไฟล์")
      setProfileUrl("")
    }
  }

  // 👇 อันนี้คือ handler ที่ผูกกับ form โดยตรง
  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      profile_url: profileUrl,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4">
        <div className="max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-xl">
          {/* close */}
          <button
            type="button"
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>

          <h2 className="text-center text-lg font-semibold mb-6">
            แก้ไขข้อมูลร้านค้า
          </h2>

          {/* ✅ ผูกกับ handler ที่รับ FormEvent */}
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* ชื่อร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                ชื่อร้าน
                <Info className="h-4 w-4 text-gray-400" />
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* คำอธิบายร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                คำอธิบายร้าน
                <Info className="h-4 w-4 text-gray-400" />
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* โลโก้ร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                โลโก้ร้าน
                <Info className="h-4 w-4 text-gray-400" />
              </label>

              <label className="flex flex-col items-center justify-center cursor-pointer border border-dashed rounded-xl py-6 hover:bg-gray-50 transition">
                <Upload className="h-6 w-6 text-gray-500" />
                <span className="mt-1 text-sm text-gray-600">Upload Files</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <p className="text-xs text-gray-500">{fileName}</p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                className="min-w-[160px] rounded-full bg-orange-500 text-white py-2.5 text-sm font-medium hover:bg-orange-600"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
