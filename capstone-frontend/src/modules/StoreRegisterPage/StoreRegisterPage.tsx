import { useState, useEffect } from "react"
import { Info, Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import * as yup from "yup"
import { toast } from "react-toastify"

import Card from "../../components/Card/Card"
import { useStoreApi } from "../../api/storeApi"
import { useUserStore } from "../../stores/userStore"
import StoreAgreementModal from "../../components/Policies/StoreAgreementModal"

// ✅ Yup schema
const storeRegisterSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("กรุณากรอกชื่อร้าน"),
  description: yup
    .string()
    .trim()
    .required("กรุณากรอกคำอธิบายร้าน"),
  agreeTerms: yup
    .boolean()
    .oneOf([true], "กรุณายอมรับ KMALL terms & policies"),
  agreeRules: yup
    .boolean()
    .oneOf([true], "กรุณายอมรับเงื่อนไขสินค้าตาม KMUTT rules"),
})

export default function StoreRegisterPage() {
  const { addStore } = useStoreApi()
  const navigate = useNavigate()

  const roles = useUserStore((s) => s.roles)
  const addRole = useUserStore((s) => s.addRole)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [fileName, setFileName] = useState("Nothing selected.")

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeRules, setAgreeRules] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [openAgreement, setOpenAgreement] = useState(true)

  const hasSellerRole = roles?.some((r) => r.toLowerCase() === "seller")

  useEffect(() => {
    if (hasSellerRole) {
      navigate("/store/me", { replace: true })
    }
  }, [hasSellerRole, navigate])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      // TODO: เปลี่ยนเป็น url จริงจากระบบอัปโหลด
      setProfileUrl(file.name)
    } else {
      setFileName("Nothing selected.")
      setProfileUrl("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ✅ ใช้ Yup validate ก่อนยิง API
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
        // เอา error แรกพอ จะได้ไม่ยาวเกิน
        const msg = err.errors[0] ?? "กรุณาตรวจสอบข้อมูลให้ถูกต้อง"
        toast.error(msg)
        return
      }
      toast.error("ข้อมูลไม่ถูกต้อง กรุณาลองใหม่")
      return
    }

    try {
      setIsSubmitting(true)

      const res = await addStore({
        name,
        description,
        profile_url: profileUrl || "",
        is_active: "YES",
      })

      console.log("STORE CREATED:", res)

      if (res.code === 201 && res.created === true) {
        addRole("seller")
        toast.success("เปิดร้านค้าสำเร็จแล้ว!")
        navigate("/store/me")
        return
      }

      const msg = "เกิดข้อผิดพลาด ไม่สามารถสร้างร้านได้"
      toast.error(msg)
    } catch (err) {
      console.error(err)
      const msg = "สร้างร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      toast.error(msg)
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
            {/* Title */}
            <h1 className="text-center text-2xl font-bold">
              ข้อมูลร้านที่จะเปิด
            </h1>

            {/* ชื่อร้าน */}
            <div className="space-y-1">
              <label className="font-medium flex items-center gap-1">
                ชื่อร้าน
                <Info className="h-4 w-4 text-gray-400" />
              </label>
              <input
                type="text"
                placeholder="Store Name"
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
                placeholder="Store Description"
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

     

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-gray-900 text-white py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
              >
                {isSubmitting ? "กำลังสร้างร้าน..." : "เปิดร้านค้า"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
