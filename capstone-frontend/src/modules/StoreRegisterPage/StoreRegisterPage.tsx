import { useState, useEffect } from "react"
import { Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import * as yup from "yup"
import { toast } from "react-toastify"

import { Input } from "../../components/Input/Input"
import { Textarea } from "../../components/Input/Textarea"
import Card from "../../components/Card/Card"
import { useStoreApi } from "../../api/storeApi"
import { useUserStore } from "../../stores/userStore"
import StoreAgreementModal from "../../components/Policies/StoreAgreementModal"
import { handleApiError } from "../../utils/handleApiError"
import { processImageFile, SUPPORTED_IMAGE_TYPES } from "../../utils/imageProcessing"
import ToggleSwitch from "../../components/Toggle/ToggleSwitch"

// ✅ Yup schema: ชื่อร้านไม่เกิน 20 ตัวอักษร, คำอธิบายไม่เกิน 200 ตัวอักษร
const storeRegisterSchema = yup.object({
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
  agreeTerms: yup
    .boolean()
    .oneOf([true], "Please accept KMALL terms & policies."),
  agreeRules: yup
    .boolean()
    .oneOf([true], "Please accept KMUTT product rules."),
})

export default function StoreRegisterPage() {
  const { addStore, addImageStore } = useStoreApi()
  const navigate = useNavigate()

  const roles = useUserStore((s) => s.roles)
  const addRole = useUserStore((s) => s.addRole)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [fileName, setFileName] = useState("Nothing selected.")
  const [logoFile, setLogoFile] = useState<File | null>(null) // 👈 เก็บไฟล์จริง ๆ
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [errors, setErrors] = useState<{ name?: boolean; description?: boolean }>({})

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeRules, setAgreeRules] = useState(false)
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState(10)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [openAgreement, setOpenAgreement] = useState(true)

  const hasSellerRole = roles?.some((r) => r.toLowerCase() === "seller")

  useEffect(() => {
    if (hasSellerRole) {
      navigate("/store/me", { replace: true })
    }
  }, [hasSellerRole, navigate])

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
      setFileName("Nothing selected.")
      setLogoFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    // ✅ รับเฉพาะรูป
    // Note: HEIC might have unique types, but processImageFile handles it.
    // We can skip strict type checking here or rely on processImageFile's result, 
    // but let's allow it to proceed if it looks like an image or has heic extension.
    
    // ✅ เช็คขนาดไฟล์ไม่เกิน 2MB (Check mostly on original or processed? 
    // Usually check original first to fail fast, but HEIC might get bigger/smaller after conversion. 
    // Let's check original first for sanity, then processed later if needed. 
    // For now, simple check.)
    if (file.size > 10 * 1024 * 1024) { // Increase limit slightly to allow high-res HEIC before conversion if needed, or keep 2MB. 
      // User originally had 2MB. HEIC can be small but convert to big JPG. 
      // Let's allow conversion first.
    }
    
    try {
      const processedFile = await processImageFile(file)
      
      // ✅ เช็คขนาดไฟล์หลังแปลง (Jpeg) ไม่เกิน 2MB (หรือตาม requirement เดิม)
      if (processedFile.size > 2 * 1024 * 1024) {
          toast.error("File size must not exceed 2MB.")
          setFileName("Nothing selected.")
          setLogoFile(null)
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
          e.target.value = ""
          return
      }

      setFileName(processedFile.name)
      setLogoFile(processedFile)
      
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(processedFile)
      setPreviewUrl(url)
    } catch (error) {
       // toast handled in processImageFile
       setFileName("File processing failed.")
       setLogoFile(null)
       e.target.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({}) // Reset errors

    // ✅ validate ด้วย yup ก่อน
    try {
      await storeRegisterSchema.validate(
        {
          name,
          description,
          agreeTerms,
          agreeRules,
        },
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
        return
      }
      const msg = "Invalid input. Please try again."
      toast.error(msg)
      return
    }

    try {
      setIsSubmitting(true)

      // 1) ✅ สร้างร้านก่อน
      const res = await addStore({
        name,
        description,
        profile_url:  "", // หรือจะส่ง "" ตรง ๆ ไปเลยก็ได้
        is_active: "YES",
        delivery_round_university_enabled: deliveryEnabled,
        round_uni_base_fee: deliveryFee,
      })

      console.log("STORE CREATED:", res)

      if (!(res.code === 201 && (res as any).created === true)) {
        const msg = "Something went wrong. Unable to create store."
        toast.error(msg)
        setIsSubmitting(false)
        return
      }

      // ดึง storeId จาก response
      const createdStore = (res as any).data as { id: number }
      const storeId = createdStore?.id

      // 2) ✅ ถ้ามีไฟล์โลโก้ → เรียก addImageStore ต่อ
      if (storeId && logoFile) {
        try {
          await addImageStore(storeId, logoFile)
        } catch (uploadErr) {
          console.error("upload logo failed:", uploadErr)
          // ร้านสร้างสำเร็จ แต่โลโก้ fail → แจ้งเตือนแยก
          toast.error("Store created, but logo upload failed.")
        }
      }

      // 3) ✅ เพิ่ม role + success + redirect
      addRole("seller")
      toast.success("Store created successfully!")
      navigate("/store/me")
    } catch (err) {
      handleApiError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (hasSellerRole) {
    return null
  }

  return (
    <>
      {/* Modal Agreement */}
      <StoreAgreementModal
        open={openAgreement}
        onClose={() => setOpenAgreement(false)}
        onConfirm={() => {
          setAgreeTerms(true)
          setAgreeRules(true)
        }}
      />
 
      <div className="max-w-3xl mx-auto py-10 text-black">
        <Card className="space-y-8 p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <h1 className="text-center text-header font-bold">
              Store Information
            </h1>
 
            {/* ชื่อร้าน */}
            <div className="space-y-1">
              <Input
                label="Store Name"
                placeholder="Store Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                error={errors.name}
              />
            </div>
 
            {/* คำอธิบายร้าน */}
            <div className="space-y-1">
              <Textarea
                label="Store Description"
                placeholder="Store Description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                error={errors.description}
                className="resize-none"
              />
            </div>
 
            {/* โลโก้ร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1 text-text">
                Store Logo
                {/* <Info className="h-4 w-4 text-gray-400" /> */}
              </label>
 
              <label className="flex flex-col bg-white items-center justify-center cursor-pointer border border-dashed rounded-xl py-6 hover:bg-gray-50 transition relative overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-32 w-32 object-cover rounded-full mb-2 border"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-gray-500" />
                )}
                <span className="mt-1 text-sm text-gray-600">
                  {previewUrl ? "Change Image" : "Upload Image"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={SUPPORTED_IMAGE_TYPES}
                  multiple={false}
                  onChange={handleFileChange}
                />
              </label>
 
              <p className="text-xs text-gray-500">{fileName}</p>
            </div>
 
            {/* ─── Delivery Settings (Redesigned) ─── */}
            <div className="pt-4 border-t border-gray-100">
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100">
                  <svg
                    className="w-4 h-4 text-orange-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414A1 1 0 0121 11.414V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                    />
                  </svg>
                </div>
                <h2 className="font-bold text-base text-gray-900">Delivery Settings</h2>
              </div>
 
              {/* Main Card */}
              <div
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  deliveryEnabled
                    ? "border-orange-200 bg-orange-50/40"
                    : "border-gray-200 bg-gray-50/60"
                }`}
              >
                {/* Toggle Row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm text-gray-900">Enable Delivery</p>
                    <p className="text-[11px] text-gray-400">
                      Allow customers to request delivery to their location
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={deliveryEnabled}
                    onChange={(val) => setDeliveryEnabled(val)}
                  />
                </div>
 
                {/* Expandable Fee Section */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    deliveryEnabled
                      ? "max-h-40 opacity-100"
                      : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="mx-5 border-t border-orange-100" />
                  <div className="px-5 py-4 flex items-end gap-4">
                    {/* Fee Input */}
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Base Delivery Fee
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-orange-500 select-none">
                          ฿
                        </span>
                        <input
                          type="number"
                          placeholder="10"
                          className="w-full bg-white border border-orange-200 rounded-xl pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Number(e.target.value))}
                          min={0}
                        />
                      </div>
                    </div>
 
                    {/* Fee Preview Badge */}
                    <div className="flex-shrink-0 bg-white border border-orange-100 rounded-xl px-4 py-2.5 text-center min-w-[88px] shadow-sm">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                        Per order
                      </p>
                      <p className="text-lg font-bold text-orange-500">฿{deliveryFee || 0}</p>
                    </div>
                  </div>
                </div>
 
                {/* Disabled hint */}
                {!deliveryEnabled && (
                  <div className="px-5 pb-4 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <p className="text-[11px] text-gray-400">
                      Delivery option will be hidden from your store
                    </p>
                  </div>
                )}
              </div>
            </div>
 
            {/* Checkboxes */}
            <div className="space-y-3 pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  I agree to{" "}
                  <button
                    type="button"
                    className="underline text-orange-600 hover:text-orange-700"
                    onClick={() => setOpenAgreement(true)}
                  >
                    KMALL terms &amp; policies
                  </button>
                </span>
              </label>
 
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  All products I sell are allowed under KMUTT rules
                </span>
              </label>
            </div>
 
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-gray-900 text-white py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? "Creating store..." : "Create Store"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
