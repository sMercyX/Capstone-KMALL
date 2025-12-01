// src/pages/store/StoreSettingsTab.tsx
import { useState } from "react"
import { useStoreStore } from "../../stores/storeStore"
import { useStoreApi } from "../../api/storeApi"
import { useNavigate } from "react-router-dom"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"

export default function StoreSettingsTab() {
  const { store, loading, error, updateStoreData } = useStoreStore()
  const { updateStore, deleteStore } = useStoreApi()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

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

  const handleDeleteStore = async () => {
    try {
      await deleteStore(store.id)
      navigate("/")
    } catch (e) {
      console.error(e)
      alert("ไม่สามารถลบร้านค้าได้")
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="bg-white border border-red-200 rounded-2xl px-6 py-4">
        <h3 className="text-lg font-medium text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          การลบร้านค้าจะไม่สามารถกู้คืนได้ โปรดตรวจสอบให้แน่ใจก่อนดำเนินการ
        </p>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
        >
          ลบร้านค้า
        </button>
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteStore}
        title="ยืนยันการลบร้านค้า"
        message="คุณต้องการลบร้านค้านี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
        confirmText="ลบร้านค้า"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </div>
  )
}
