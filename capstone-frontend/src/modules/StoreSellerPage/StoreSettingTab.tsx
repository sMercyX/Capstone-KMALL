// src/pages/store/StoreSettingsTab.tsx
import { useState } from "react"
import { useStoreStore } from "../../stores/storeStore"
import { useStoreApi } from "../../api/storeApi"

export default function StoreSettingsTab() {
  const { store, loading, error, updateStoreData } = useStoreStore()
  const { updateStore } = useStoreApi()

  const [saving, setSaving] = useState(false)

 

  if (loading) return <div className="text-gray-500">กำลังโหลดข้อมูลร้าน…</div>
  if (error || !store) {
    return <div className="text-red-500">ไม่พบข้อมูลร้าน หรือโหลดไม่สำเร็จ</div>
  }

  const isOpen = store.is_active === "YES"

  const handleToggle = async () => {
    if (saving) return
    setSaving(true)

    const newStatus = isOpen ? "NO" : "YES"

    try {
      // ส่งไป BE แค่ is_active
      await updateStore(store.id, { is_active: newStatus })

      // อัปเดตค่าใน zustand ให้ UI เปลี่ยนทันที
      updateStoreData({ is_active: newStatus })
    } catch (e) {
      console.error(e)
      alert("ไม่สามารถอัปเดตสถานะร้านได้")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border rounded-2xl px-6 py-4 flex items-center justify-between">
      <div className="text-[16px] font-medium text-black">เปิด / ปิดร้าน</div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition
          ${isOpen ? "bg-blue-500" : "bg-gray-300"}
          ${saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition
            ${isOpen ? "translate-x-5" : "translate-x-1"}
          `}
        />
      </button>
    </div>
  )
}
