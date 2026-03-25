// src/components/Store/StoreEditModal.tsx
import { useEffect, useState } from "react"
import { Upload, X } from "lucide-react"
import * as yup from "yup"
import { toast } from "react-toastify"
import ToggleSwitch from "../../../../components/Toggle/ToggleSwitch"
import { Input } from "../../../../components/Input/Input"
import { Textarea } from "../../../../components/Input/Textarea"
import { resolveImageUrl } from "../../../../utils/resolve"

export type StoreEditForm = {
  name: string
  description: string
  profile_url: string
  delivery_round_university_enabled: boolean
  round_uni_base_fee: number
}

import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../../utils/imageProcessing"

interface StoreEditModalProps {
  isOpen: boolean
  initialName: string
  initialDescription: string
  initialProfileUrl: string
  initialDeliveryEnabled: boolean
  initialDeliveryFee: number
  onClose: () => void
  // ส่งทั้ง data + logoFile ออกไปให้ parent จัดการ
  onSubmit: (data: StoreEditForm, file: File | null) => void | Promise<void>
}

// ✅ schema สำหรับแก้ไขร้าน: ชื่อ ≤ 100 ตัวอักษร, คำอธิบาย ≤ 255 ตัวอักษร
const storeEditSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Please enter a store name.")
    .max(100, "Store name must be at most 100 characters."),
  description: yup
    .string()
    .trim()
    .required("Please enter a store description.")
    .max(255, "Store description must be at most 255 characters."),
})

export default function StoreEditModal({
  isOpen,
  initialName,
  initialDescription,
  initialProfileUrl,
  initialDeliveryEnabled,
  initialDeliveryFee,
  onClose,
  onSubmit,
}: StoreEditModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [fileName, setFileName] = useState("No file selected.")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState(0)
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
    setFileName(initialProfileUrl || "No file selected.")
    setDeliveryEnabled(!!initialDeliveryEnabled)
    setDeliveryFee(initialDeliveryFee || 0)
    setLogoFile(null)
  }, [isOpen, initialName, initialDescription, initialProfileUrl, initialDeliveryEnabled, initialDeliveryFee])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file) {
      setLogoFile(null)
      setFileName("No file selected.")
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    // ✅ รับเฉพาะไฟล์ภาพ (or HEIC)
    // Note: processImageFile handles validation implicitly or we can skip strict type checking 
    // if accept attribute is set correctly.
    // Let's rely on processImageFile and basic checks.
    
    // ✅ เช็คขนาดไฟล์ไม่เกิน (Check original size roughly)
    if (file.size > 10 * 1024 * 1024) {
       // Allow larger for HEIC conversion
    }

    try {
        const processedFile = await processImageFile(file)
        
        if (processedFile.size > 2 * 1024 * 1024) {
            toast.error("File size must not exceed 2MB.")
            e.target.value = ""
            setLogoFile(null)
            setFileName("No file selected.")
            if (previewUrl) URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
            return
        }

        setLogoFile(processedFile)
        setFileName(processedFile.name)

        if (previewUrl) URL.revokeObjectURL(previewUrl)
        const url = URL.createObjectURL(processedFile)
        setPreviewUrl(url)
    } catch (error) {
        // toast handled in processImageFile
        setLogoFile(null)
        setFileName("File processing failed.")
         e.target.value = ""
    }
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
        toast.error("Invalid input. Please try again.")
      }
      return
    }

    await onSubmit(
      {
        name: name.trim(),
        description: description.trim(),
        profile_url: profileUrl,
        delivery_round_university_enabled: deliveryEnabled,
        round_uni_base_fee: deliveryFee,
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
            Edit Store Information
          </h2>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* ชื่อร้าน */}
            <div className="space-y-1">
              <Input
                label="Store Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                error={errors.name}
              />
              <p className="text-xs text-gray-500 text-right">
                {name.length} / 100 characters
              </p>
            </div>

            {/* คำอธิบายร้าน */}
            <div className="space-y-1">
              <Textarea
                label="Store Description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                error={errors.description}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 text-right">
                {description.length} / 255 characters
              </p>
            </div>

            {/* โลโก้ร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                Store Logo
              </label>

              <label className="flex flex-col bg-white items-center justify-center cursor-pointer border border-dashed rounded-xl py-6 hover:bg-gray-50 transition relative overflow-hidden">
                {previewUrl || profileUrl ? (
                  <img 
                    src={previewUrl || resolveImageUrl(profileUrl)} 
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
                  accept={SUPPORTED_IMAGE_TYPES}   // ✅ เฉพาะไฟล์ภาพ
                  multiple={false}   // ✅ เลือกได้รูปเดียว
                  onChange={handleFileChange}
                />
              </label>

              <p className="text-xs text-gray-500">{fileName}</p>
            </div>

            {/* การตั้งค่าการจัดส่ง */}
            <div className="pt-4 border-t border-gray-100">
               <h3 className="text-sm font-bold text-gray-900 mb-4">Delivery Settings</h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                     <div>
                        <p className="text-sm font-semibold text-gray-900">Round University Delivery</p>
                        <p className="text-xs text-gray-500">Enable delivery service around the university campus.</p>
                     </div>
                     <ToggleSwitch checked={deliveryEnabled} onChange={setDeliveryEnabled} />
                  </div>

                  {deliveryEnabled && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Input
                        label="Delivery Fee (฿)"
                        type="number"
                        value={deliveryFee.toString()}
                        onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        placeholder="e.g. 10"
                      />
                      <p className="text-[11px] text-gray-400 ml-1">Set the fixed delivery fee for university-area orders.</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                className="min-w-[160px] rounded-full bg-orange-500 text-white py-2.5 text-sm font-medium hover:bg-orange-600"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
