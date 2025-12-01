// src/components/Store/StoreEditModal.tsx
import { useEffect, useState } from "react"
import { Upload, X } from "lucide-react"
import * as yup from "yup"
import { toast } from "react-toastify"
import { Input } from "../../../../components/Input/Input"
import { Textarea } from "../../../../components/Input/Textarea"

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
  // ส่งทั้ง data + logoFile ออกไปให้ parent จัดการ
  onSubmit: (data: StoreEditForm, file: File | null) => void | Promise<void>
}

// ✅ schema สำหรับแก้ไขร้าน: ชื่อ ≤ 100 ตัวอักษร, คำอธิบาย ≤ 255 ตัวอักษร
const storeEditSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("กรุณากรอกชื่อร้าน")
    .max(100, "ชื่อร้านต้องไม่เกิน 100 ตัวอักษร"),
  description: yup
    .string()
    .trim()
    .required("กรุณากรอกคำอธิบายร้าน")
    .max(255, "คำอธิบายร้านต้องไม่เกิน 255 ตัวอักษร"),
})

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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: boolean; description?: boolean }>({})

  // lock scroll ตอน modal เปิด
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // sync ค่าเริ่มต้นทุกครั้งที่เปิด modal
  useEffect(() => {
    if (!isOpen) return
    setName(initialName || "")
    setDescription(initialDescription || "")
    setProfileUrl(initialProfileUrl || "")
    setFileName(initialProfileUrl || "ยังไม่ได้เลือกไฟล์")
    setLogoFile(null)
  }, [isOpen, initialName, initialDescription, initialProfileUrl])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file) {
      setLogoFile(null)
      setFileName("ยังไม่ได้เลือกไฟล์")
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    // ✅ รับเฉพาะไฟล์ภาพ
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ")
      e.target.value = ""
      setLogoFile(null)
      setFileName("ยังไม่ได้เลือกไฟล์")
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    // ✅ เช็คขนาดไฟล์ไม่เกิน 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 2MB")
      e.target.value = ""
      setLogoFile(null)
      setFileName("ยังไม่ได้เลือกไฟล์")
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    setLogoFile(file)
    setFileName(file.name)

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  // ✅ handler form + validate ด้วย Yup + แจ้ง error ด้วย toast
  // ✅ handler form + validate ด้วย Yup + แจ้ง error ด้วย toast
  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({}) // Reset errors

    try {
      await storeEditSchema.validate(
        { name, description },
        { abortEarly: false }
      )
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const newErrors: { name?: boolean; description?: boolean } = {}
        let firstMsg = ""

        err.inner.forEach((error) => {
          if (error.path === "name") newErrors.name = true
          if (error.path === "description") newErrors.description = true
          if (!firstMsg) firstMsg = error.message
        })

        setErrors(newErrors)
        toast.error(firstMsg)
      } else {
        toast.error("ข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง")
      }
      return
    }

    await onSubmit(
      {
        name: name.trim(),
        description: description.trim(),
        profile_url: profileUrl,
      },
      logoFile
    )
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

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* ชื่อร้าน */}
            <div className="space-y-1">
              <Input
                label="ชื่อร้าน"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                error={errors.name}
              />
              <p className="text-xs text-gray-500 text-right">
                {name.length} / 100 ตัวอักษร
              </p>
            </div>

            {/* คำอธิบายร้าน */}
            <div className="space-y-1">
              <Textarea
                label="คำอธิบายร้าน"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                error={errors.description}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 text-right">
                {description.length} / 255 ตัวอักษร
              </p>
            </div>

            {/* โลโก้ร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                โลโก้ร้าน
              </label>

              <label className="flex flex-col bg-white items-center justify-center cursor-pointer border border-dashed rounded-xl py-6 hover:bg-gray-50 transition relative overflow-hidden">
                {previewUrl || profileUrl ? (
                  <img 
                    src={previewUrl || profileUrl} 
                    alt="Preview" 
                    className="h-32 w-32 object-cover rounded-full mb-2 border"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-gray-500" />
                )}
                <span className="mt-1 text-sm text-gray-600">
                  {previewUrl || profileUrl ? "Change Image" : "Upload Image"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"   // ✅ เฉพาะไฟล์ภาพ
                  multiple={false}   // ✅ เลือกได้รูปเดียว
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
