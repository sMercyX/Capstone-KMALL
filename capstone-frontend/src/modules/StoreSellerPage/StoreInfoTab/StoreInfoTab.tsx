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
    <div className="p-0 text-slate-800 pb-16 w-full font-sans">
      
      {/* Header Area */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-2">
            Store &gt; <span className="font-semibold text-gray-600">Information</span>
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Store Information
          </h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Review your store details and update them to make your storefront more trustworthy.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center px-6 py-2.5 font-bold text-white rounded-xl bg-orange-500 hover:bg-orange-600 shadow-[0_4px_12px_rgba(249,115,22,0.2)] hover:-translate-y-0.5 transition-all duration-300 shrink-0"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit Information
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Card 1: Public Identity */}
        <div className="bg-white border border-gray-200/60 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-[#f8fafc]/50">
            <h3 className="text-base font-bold text-gray-900">Public Identity</h3>
            <p className="text-sm text-gray-500 mt-1">The branding and description that customers will see.</p>
          </div>

          <div className="px-6 py-8 flex flex-col sm:flex-row items-center sm:items-start gap-8">
            <div className="flex flex-col items-center justify-center gap-3 shrink-0">
              <div className="relative group w-32 h-32 rounded-full border border-gray-100 shadow-sm overflow-hidden bg-gray-50">
                <img 
                  src={store.profile_url ? resolveImageUrl(store.profile_url) : "/images/default-store.png"} 
                  className="w-full h-full object-cover " 
                  alt="Store Logo"
                />
              </div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Store Logo</label>

            </div>

            <div className="flex-1 w-full flex flex-col pt-1">
              <div className="pb-6">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Store Name</label>
                <div className="mt-1.5 text-2xl font-black text-gray-900 tracking-tight">{store.name || <span className="text-gray-300">Unnamed Store</span>}</div>
              </div>
              
              <div className="h-px w-full bg-gray-100 mb-6"></div>
              
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                <div className="mt-2 text-[15px] font-medium text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {store.description || <span className="italic text-gray-400">Tell your customers what makes your store special. Add your story and product highlights here.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Fulfillment & Logistics */}
        <div className="bg-white border border-gray-200/60 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-[#f8fafc]/50">
            <h3 className="text-base font-bold text-gray-900">Fulfillment & Logistics</h3>
            <p className="text-sm text-gray-500 mt-1">Configure how you deliver products to your buyers.</p>
          </div>

          <div className="px-6 py-6 flex flex-col gap-6">
            {/* Row 1: Delivery Method */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Round University Delivery
                </div>
                <div className="text-sm font-medium text-gray-500 mt-1">Enable or disable delivery services for your campus area.</div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase shadow-sm flex items-center gap-1.5 border shrink-0 ${store.delivery_round_university_enabled ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                {store.delivery_round_university_enabled ? '● Active' : 'Disabled'}
              </div>
            </div>

            <div className="h-px w-full bg-gray-100"></div>

            {/* Row 2: Base Fee */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Base Delivery Fee
                </div>
                <div className="text-sm font-medium text-gray-500 mt-1">The standard delivery charge applied to orders.</div>
              </div>
              <div className="flex items-baseline gap-1.5 bg-[#f8fafc] px-5 py-2.5 rounded-xl border border-gray-200 shrink-0">
                <span className="text-lg font-bold text-orange-500">฿</span>
                <span className="text-3xl font-black text-gray-900 tracking-tight">
                  {store.delivery_round_university_enabled ? (store.round_uni_base_fee ?? 0).toLocaleString() : '-'}
                </span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">THB</span>
              </div>
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
