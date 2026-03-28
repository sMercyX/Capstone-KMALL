// src/components/Store/StoreEditModal.tsx
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import * as yup from "yup"
import { toast } from "react-toastify"
import ToggleSwitch from "../../../../components/Toggle/ToggleSwitch"

export type StoreEditForm = {
  name: string
  description: string
  profile_url: string
  delivery_round_university_enabled: boolean
  round_uni_base_fee: number
}

import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../../../utils/imageProcessing"
import { resolveImageUrl } from "../../../../utils/resolve"

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

    if (file.size > 10 * 1024 * 1024) {
       toast.error("File size must not exceed 10MB.")
       e.target.value = ""
       setLogoFile(null)
       setFileName("No file selected.")
       if (previewUrl) URL.revokeObjectURL(previewUrl)
       setPreviewUrl(null)
       return
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

      <div className="relative z-10 w-full max-w-3xl mx-4">
        <div className="max-h-[85vh] overflow-y-auto rounded-[1.25rem] bg-white shadow-xl scrollbar-hide">
          
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white px-8 py-6 border-b border-gray-200 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-orange-200">
                <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Store Information</h2>
                <p className="text-[13px] text-gray-500 mt-1">Update your store details and delivery configuration.</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-1 h-8 w-8 rounded-md text-gray-500 flex items-center justify-center hover:bg-gray-100 hover:text-gray-900 transition-colors"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="p-8 space-y-8">
            
            {/* General Information Section */}
            <div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-5">General Information</h3>
              
              <div className="space-y-6">
                {/* Store Name */}
                <div>
                  <label className="block text-[13px] font-bold text-gray-900 mb-2">Store Name :</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    className={`w-full rounded-[0.5rem] bg-[#f8fafc] border ${errors.name ? 'border-red-500' : 'border-gray-300'} px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500`}
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">Please enter a valid store name.</p>}
                </div>

                {/* Shop Logo */}
                <div>
                  <label className="block text-[13px] font-bold text-gray-900 mb-2">Shop Logo :</label>
                  
                  <div className="flex items-center gap-3 w-full rounded-[0.5rem] bg-[#f8fafc] border border-gray-300 px-3 py-2.5">
                     <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-4 py-1.5 rounded-md shadow-sm">
                       Choose File
                       <input
                         type="file"
                         className="hidden"
                         accept={SUPPORTED_IMAGE_TYPES}
                         multiple={false}
                         onChange={handleFileChange}
                       />
                     </label>
                     <span className="text-[13px] text-gray-500 font-medium">{fileName !== "No file selected." && fileName !== (initialProfileUrl || "No file selected.") ? "1 file" : "No file selected"}</span>
                  </div>

                  {/* Image Guidelines Box */}
                  <div className="mt-4 rounded-[0.5rem] border border-[#fde68a] bg-[#fef3c7]/60 p-4">
                    <div className="flex items-center gap-2 mb-2 text-[#b45309]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <h4 className="text-[13px] font-bold">Image Guidelines</h4>
                    </div>
                    <ul className="text-[12px] font-bold text-[#b45309]/80 space-y-1.5 ml-1">
                      <li>• Recommended Image size: 300 x 300 px</li>
                      <li>• Maximum file size: 2.0 MB</li>
                      <li>• Supported formats: JPG, JPEG, PNG</li>
                    </ul>
                  </div>

                  {/* Image Preview */}
                  <div className="flex flex-col items-center mt-4 ">
                    <div className="relative group w-32 h-32 justify-center rounded-full border border-gray-100 shadow-sm overflow-hidden bg-gray-50">
                      <img 
                        src={previewUrl ? previewUrl : profileUrl ? resolveImageUrl(profileUrl) : "/images/default-store.png" } 
                        className="w-full h-full object-cover" 
                        alt="Store Logo"
                      />
                  </div>
                  <p className="text-[13px] text-gray-500 font-medium mt-2">{name}</p>
                  </div>
                 
                </div>

                {/* Store Description */}
                <div>
                  <label className="block text-[13px] font-bold text-gray-900 mb-2">Store Description :</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={255}
                    className={`w-full rounded-[0.5rem] bg-[#f8fafc] border ${errors.description ? 'border-red-500' : 'border-gray-300'} px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none`}
                  />
                  {errors.description && <p className="text-xs text-red-500 mt-1">Please enter a valid store description.</p>}
                </div>
              </div>
            </div>

            {/* Delivery Information Section */}
            <div className="pt-2">
              <h3 className="text-[17px] font-bold text-gray-900 mb-5">Delivery Information</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-bold text-gray-900 mb-2">Round University Delivery :</label>
                  <div className="w-full rounded-[0.5rem] bg-[#f8fafc] border border-gray-300 px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-600">Enable delivery service around campus</span>
                    <ToggleSwitch checked={deliveryEnabled} onChange={setDeliveryEnabled} />
                  </div>
                </div>

                {deliveryEnabled && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[13px] font-bold text-gray-900 mb-2">Delivery Fee (฿) :</label>
                    <input
                      type="number"
                      value={deliveryFee.toString()}
                      onChange={(e) => setDeliveryFee(Number(e.target.value))}
                      placeholder="e.g. 10"
                      className="w-full rounded-[0.5rem] bg-[#f8fafc] border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-center gap-3 w-full pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 md:w-[220px] rounded-lg bg-gray-500 text-white py-[11px] text-[13px] font-semibold hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 md:w-[220px] rounded-lg bg-[#ff5722] text-white py-[11px] text-[13px] font-semibold hover:bg-[#eb4a19] transition-colors"
              >
                Save Changes
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
