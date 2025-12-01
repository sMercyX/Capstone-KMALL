import { useState, useEffect } from "react"
import { Info, Upload } from "lucide-react"
import Card from "../../components/Card/Card"
import { useStoreApi } from "../../api/storeApi"
import { useNavigate } from "react-router-dom"
import { useUserStore } from "../../stores/userStore"

export default function StoreRegisterPage() {
  const { addStore } = useStoreApi()
  const navigate = useNavigate()

  const roles = useUserStore((s) => s.roles)
  const addRole = useUserStore((s) => s.addRole)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [profileUrl, setProfileUrl] = useState("") // ส่งเข้า profile_url
  const [fileName, setFileName] = useState("Nothing selected.")

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeRules, setAgreeRules] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 🔒 ถ้ามี role seller อยู่แล้ว ห้ามเข้าหน้านี้ → เด้งไป /store/me
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
    setError(null)
    setSuccess(false)

    if (!name.trim() || !description.trim()) {
      setError("กรุณากรอกชื่อร้านและคำอธิบายร้าน")
      return
    }

    if (!agreeTerms || !agreeRules) {
      setError("กรุณายอมรับเงื่อนไขทั้งหมดก่อนเปิดร้าน")
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

      // ✅ ตรวจสอบเงื่อนไข response
      if (res.code === 201 && res.created === true) {
        // เพิ่ม role seller ใน FE
        addRole("seller")
        navigate("/store/me") // redirect ไปหน้าร้านของฉัน
        return
      }

      setError("เกิดข้อผิดพลาด ไม่สามารถสร้างร้านได้")
    } catch (err) {
      console.error(err)
      setError("สร้างร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsSubmitting(false)
    }
  }

  // กันเฟรมวิ่งแวบ ๆ ตอน redirect
  if (hasSellerRole) {
    return null
  }

  return (
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
                I agree to KMALL terms &amp; policies
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

          {/* Error / Success */}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-600">เปิดร้านสำเร็จแล้ว!</p>
          )}

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
  )
}
