// src/pages/Store/StoreInfoTab.tsx
import { useEffect, useState } from "react"
import { useStoreApi } from "../../../api/storeApi"
import { useStoreStore } from "../../../stores/storeStore"
import type { StoreEditForm } from "./StoreEditModal/StoreEditModal"
import StoreEditModal from "./StoreEditModal/StoreEditModal"

export default function StoreInfoTab() {
  const { updateStore } = useStoreApi()

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
  async function handleSubmitEdit(data: StoreEditForm) {
    try {
      const res = await updateStore(store!.id, {
        name: data.name,
        description: data.description,
        profile_url: data.profile_url ?? "",
        is_active: "YES",
      })

      console.log("UPDATED STORE:", res)

      // อัปเดตค่าใน global store (FE)
      const updated = (res as any).data
      if (updated) {
        updateStoreData({
          name: updated.name,
          description: updated.description,
          profile_url: updated.profile_url,
        })
      }

      setIsModalOpen(false)
    } catch (err) {
      console.error("update store failed:", err)
      // จะเพิ่ม toast หรือ error message เพิ่มเติมก็ได้
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
            src={store.profile_url || "/images/default-store.png"}
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
