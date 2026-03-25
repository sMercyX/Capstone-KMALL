// src/pages/Store/StoreInfoTab.tsx
import { useState } from "react"
import { toast } from "react-toastify"

import { useStoreApi, type storePictureResponse } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import type { StoreEditForm } from "./StoreEditModal/StoreEditModal"
import StoreEditModal from "./StoreEditModal/StoreEditModal"
import { handleApiError } from "../../../utils/handleApiError"
import { resolveImageUrl } from "../../../utils/resolve"

export default function StoreInfoTab() {
  const { updateStore, addImageStore, editImageStore } = useStoreApi()
  const { store, loading, error, updateStoreData } = useStoreStore()

  const [isModalOpen, setIsModalOpen] = useState(false)

  

  if (loading) return <p className="text-center">Loading store information...</p>
  if (error) return <p className="text-center text-red-500">{error}</p>
  if (!store) return <p className="text-center text-red-500">Store information not found.</p>

  // เวลากด "บันทึก" จาก Modal
  async function handleSubmitEdit(data: StoreEditForm, logoFile: File | null) {
    try {
      let primaryImageUrl = store!.profile_url ?? ""
      let imageError = false

      // 1) ถ้ามีไฟล์โลโก้ใหม่ → upload ก่อน
      if (logoFile) {
        try {
          const uploadRes = await addImageStore(store!.id, logoFile)
          // 🔴 จริง ๆ data เป็น Array(1) → ต้องอ่าน index 0
          const list = (uploadRes as any).data as storePictureResponse[] | storePictureResponse

          const uploaded = Array.isArray(list) ? list[0] : list

          if (uploaded && uploaded.id) {
            // 2) set รูปนี้เป็น primary
            const editRes = await editImageStore(uploaded.id, {
              is_primary: true,
            })
            const edited = (editRes as any).data as storePictureResponse

            if (edited?.image_url) {
              primaryImageUrl = edited.image_url
            } else if (uploaded.image_url) {
              // fallback ถ้า backend ไม่ส่ง image_url ใหม่
              primaryImageUrl = uploaded.image_url
            }
          }
        } catch {
          imageError = true
          toast.error("Failed to upload the new logo.")
        }
      }

      // 3) update ข้อมูลร้าน + profile_url ให้ใช้รูปใหม่ (ถ้ามี)
      const res = await updateStore(store!.id, {
        name: data.name,
        description: data.description,
        profile_url: primaryImageUrl,
        is_active: "YES",
        delivery_round_university_enabled: data.delivery_round_university_enabled,
        round_uni_base_fee: data.round_uni_base_fee,
      })

      const updatedStore = (res as any).data as {
        name?: string
        description?: string
        profile_url?: string
      }

      // 4) อัปเดต global store ฝั่ง FE
      updateStoreData({
        name: updatedStore?.name ?? data.name,
        description: updatedStore?.description ?? data.description,
        profile_url:
          updatedStore?.profile_url ?? primaryImageUrl ?? store!.profile_url,
        delivery_round_university_enabled: data.delivery_round_university_enabled,
        round_uni_base_fee: data.round_uni_base_fee,
      })

      if (!imageError) {
        toast.success("Store information updated successfully!")
      }

      setIsModalOpen(false)
    } catch (err) {
      handleApiError(err)
    }
  }

return (
  <>
    <div className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-8 shadow-sm text-black">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">
            Store Information
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Review your store details and update them to make your storefront more trustworthy.
          </p>
        </div>

        {/* SINGLE CTA */}
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-[0.98] active:scale-[0.99] transition"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Edit Store Information
        </button>
      </div>

      <div className="mt-6 h-px w-full bg-gray-200/70" />

      {/* Content */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Store details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Name */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500">
                  Store Name
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  This is the name customers will see on your storefront and product listings.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700">
                Read only
              </span>
            </div>

            <input
              type="text"
              disabled
              value={store.name}
              className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 font-semibold focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500">
                  Store Description
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  Keep it short, clear, and concise to build customer confidence.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700">
                Read only
              </span>
            </div>

            <textarea
              disabled
              value={store.description}
              className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 h-36 text-gray-800 resize-none focus:outline-none"
            />
          </div>

          {/* Delivery Settings Display */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Delivery Configuration
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  Settings for how you deliver products to university customers.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Method: Round University</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${store.delivery_round_university_enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-300'}`} />
                  <span className="text-sm font-bold text-gray-900">
                    {store.delivery_round_university_enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
              
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Base Delivery Fee</p>
                <p className="text-sm font-bold text-gray-900">
                  {store.delivery_round_university_enabled ? `฿${(store.round_uni_base_fee ?? 0).toLocaleString()}` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Logo */}
        <div className="lg:col-span-1">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Store Logo</p>
                <p className="mt-1 text-xs text-gray-600">
                  A clear logo helps your store look more professional.
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                  store.profile_url
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {store.profile_url ? "Set" : "Not set"}
              </span>
            </div>

            <div className="mt-5 flex justify-center">
              <div className="relative">
                {/* subtle ring */}
                <div className="absolute -inset-2 rounded-[28px] bg-orange-100/60 blur-xl" />
                <img
                  src={
                    store.profile_url
                      ? resolveImageUrl(store.profile_url)
                      : "/images/default-store.png"
                  }
                  alt="store-logo"
                  className="relative w-44 h-44 object-cover rounded-[28px] border border-white shadow-lg ring-1 ring-black/5"
                />
                <div className="absolute inset-0 rounded-[28px] ring-1 ring-white/70" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-700">
                Tip: Use a square image, simple background, and clear text.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Modal แก้ไขข้อมูลร้าน */}
    <StoreEditModal
      isOpen={isModalOpen}
      initialName={store.name}
      initialDescription={store.description}
      initialProfileUrl={store.profile_url}
      initialDeliveryEnabled={store.delivery_round_university_enabled}
      initialDeliveryFee={store.round_uni_base_fee}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleSubmitEdit}
    />
  </>
)





}
