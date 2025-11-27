// src/pages/Store/StoreInfoTab.tsx
import { useEffect, useState } from "react"
import { toast } from "react-toastify"

import { useStoreApi, type storePictureResponse } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import type { StoreEditForm } from "./StoreEditModal/StoreEditModal"
import StoreEditModal from "./StoreEditModal/StoreEditModal"

export default function StoreInfoTab() {
  const { updateStore, addImageStore, editImageStore } = useStoreApi()
  const { store, loading, error, fetchStore, updateStoreData } = useStoreStore()

  const [isModalOpen, setIsModalOpen] = useState(false)

  // โหลดข้อมูลร้านตอนเข้าแท็บนี้ครั้งแรก
  useEffect(() => {
    fetchStore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        } catch (uploadErr) {
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
      toast.error("ไม่สามารถแก้ไขข้อมูลร้านได้ กรุณาลองใหม่อีกครั้ง")
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-black">
        {/* LEFT: ข้อมูลร้านแบบอ่านอย่างเดียว */}
        <div className="space-y-5">
          <div>
            <label className="block font-semibold mb-1 ">ชื่อร้าน</label>
            <input
              type="text"
              disabled
              value={store.name}
              className="w-full border rounded-lg p-3 bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">คำอธิบายร้าน</label>
            <textarea
              disabled
              value={store.description}
              className="w-full border rounded-lg p-3 h-28 bg-white"
            />
          </div>
        </div>

        {/* RIGHT: โลโก้ร้าน */}
        <div className="flex flex-col items-center justify-start">
          <p className="font-semibold mb-2">โลโก้ร้าน</p>
          <img
            src={
              store.profile_url
                ? `http://localhost:8000${store.profile_url}`
                : "/images/default-store.png"
            }
            alt="store-logo"
            className="w-40 h-40 object-cover rounded-full border shadow"
          />
        </div>
      </div>

      <div className="w-full flex justify-center mt-6">
        <button
          className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          แก้ไขข้อมูลร้านค้า
        </button>
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
