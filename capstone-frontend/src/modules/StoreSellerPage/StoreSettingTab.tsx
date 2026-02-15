// src/pages/store/StoreSettingsTab.tsx
import { useState } from "react"
import { useStoreStore } from "../../stores/storeStore"
import { useUserStore } from "../../stores/userStore"
import { useStoreApi } from "../../api/storeApi"
import { useNavigate } from "react-router-dom"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"
import { toast } from "react-toastify"
import { handleApiError } from "../../utils/handleApiError"

export default function StoreSettingsTab() {
  const { store, loading, error, updateStoreData } = useStoreStore()
  const { updateStore, deleteStore } = useStoreApi()
  const navigate = useNavigate()
  const { fetchUser } = useUserStore()

  const [saving, setSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  if (loading) return <div className="text-gray-500">Loading store information...</div>
  if (error || !store) {
    return <div className="text-red-500">Store information not found or failed to load.</div>
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
      handleApiError(e)
    } finally {
      setSaving(false)
    }
  }



  const handleDeleteStore = async () => {
    try {
      await deleteStore(store.id)
      await fetchUser()
      toast.success("Store deleted successfully.")
      navigate("/dashboard")
    } catch (e) {
      handleApiError(e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="text-[16px] font-medium text-black">Open / Close Store</div>

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
          Deleting your store cannot be undone. Please confirm before proceeding.
        </p>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
        >
          Delete Store
        </button>
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteStore}
        title="Confirm Store Deletion"
        message="Are you sure you want to delete this store? This action cannot be undone."
        confirmText="Delete Store"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
