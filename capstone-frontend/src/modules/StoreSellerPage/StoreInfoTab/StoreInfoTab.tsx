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

  

  if (loading) return <p className="text-center">กำลังโหลดข้อมูลร้าน...</p>
  if (error) return <p className="text-center text-red-500">{error}</p>
  if (!store) return <p className="text-center text-red-500">ไม่พบข้อมูลร้าน</p>

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
          toast.error("อัปโหลดโลโก้ใหม่ไม่สำเร็จ")
        }
      }

      // 3) update ข้อมูลร้าน + profile_url ให้ใช้รูปใหม่ (ถ้ามี)
      const res = await updateStore(store!.id, {
        name: data.name,
        description: data.description,
        profile_url: primaryImageUrl,
        is_active: "YES",
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
      })

      if (!imageError) {
        toast.success("แก้ไขข้อมูลร้านค้าสำเร็จแล้ว!")
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
            ข้อมูลร้านค้า
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            ตรวจสอบรายละเอียดร้านของคุณ และแก้ไขเพื่อให้หน้าร้านดูน่าเชื่อถือมากขึ้น
          </p>
        </div>

        {/* SINGLE CTA */}
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-[0.98] active:scale-[0.99] transition"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          แก้ไขข้อมูลร้านค้า
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
                  ชื่อร้าน
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  ชื่อที่ผู้ซื้อจะเห็นบนหน้าร้านและรายการสินค้า
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
                  คำอธิบายร้าน
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  เขียนให้สั้น กระชับ และชัดเจน เพื่อเพิ่มความมั่นใจให้ผู้ซื้อ
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
        </div>

        {/* RIGHT: Logo */}
        <div className="lg:col-span-1">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">โลโก้ร้าน</p>
                <p className="mt-1 text-xs text-gray-600">
                  โลโก้ที่ชัดเจนช่วยให้ร้านดูมืออาชีพ
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                  store.profile_url
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {store.profile_url ? "ตั้งค่าแล้ว" : "ยังไม่มี"}
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
                แนะนำ: ใช้รูปสี่เหลี่ยม พื้นหลังเรียบ และตัวหนังสือชัดเจน
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
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleSubmitEdit}
    />
  </>
)





}
