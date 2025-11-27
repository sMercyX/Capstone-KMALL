// src/components/Modal/OpenStoreAgreementModal.tsx
import { useEffect, useState } from "react"

type Props = {
  open: boolean
  onClose: () => void
  onConfirm?: () => void
}

export default function StoreAgreementModal({
  open,
  onClose,
  onConfirm,
}: Props) {
  const [canConfirm, setCanConfirm] = useState(false)

  // รีเซ็ตสถานะทุกครั้งที่เปิดใหม่
  useEffect(() => {
    if (open) {
      setCanConfirm(false)
    }
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.()
    onClose()
  }

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget
    const isBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 8 // กันเคสเหลือเสี้ยวเดียว
    if (isBottom && !canConfirm) {
      setCanConfirm(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white px-8 py-8 md:px-12 md:py-10 shadow-xl">
        <div className="space-y-4 md:space-y-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">
              ข้อตกลงในการเปิดร้านค้า
            </h2>
            <p className="mt-2 text-sm md:text-base text-gray-600">
              กรุณาอ่านและยอมรับเงื่อนไขในการเป็นผู้ขายบนแพลตฟอร์ม KMALL
            </p>
          </div>

          {/* เนื้อหาที่ต้องเลื่อนอ่าน */}
          <div
            className="max-h-80 md:max-h-96 overflow-y-auto pr-2 text-sm md:text-base text-gray-700 space-y-3 border rounded-xl px-4 py-3 bg-gray-50"
            onScroll={handleScroll}
          >
            <p>การเปิดร้านค้าบน KMALL หมายถึงคุณยอมปฏิบัติตามเงื่อนไขดังต่อไปนี้:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>สินค้าทั้งหมดต้องถูกต้องตามกฎหมาย ไม่ละเมิดลิขสิทธิ์ และไม่เป็นสินค้าต้องห้ามตามข้อกำหนดของมหาวิทยาลัยและกฎหมายไทย</li>
              <li>ข้อมูลสินค้า ราคา โปรโมชั่น และสต็อกสินค้าต้องเป็นความจริง ไม่หลอกลวง หรือทำให้ผู้ซื้อเข้าใจผิด</li>
              <li>ผู้ขายต้องรับผิดชอบต่อการจัดส่งสินค้าให้ถึงมือลูกค้าตรงเวลาตามที่ระบุ รวมถึงการแพ็กสินค้าอย่างเหมาะสมและปลอดภัย</li>
              <li>หากเกิดปัญหา เช่น สินค้าเสียหาย ส่งผิด หรือส่งไม่ครบ ผู้ขายต้องให้ความร่วมมือในการแก้ไขปัญหาและบริการหลังการขายอย่างเหมาะสม</li>
              <li>ห้ามขายสินค้าที่เกี่ยวข้องกับแอลกอฮอล์ ยาเสพติด อาวุธ สื่อลามก หรือสินค้าที่ขัดต่อศีลธรรมและนโยบายของ KMUTT ทุกกรณี</li>
              <li>ผู้ขายต้องไม่ใช้ข้อมูลของผู้ซื้อในทางที่ผิด เช่น การนำข้อมูลติดต่อไปใช้ในเชิงการตลาดโดยไม่ได้รับอนุญาต</li>
              <li>ผู้ขายต้องยินยอมให้ทีมงาน KMALL ตรวจสอบข้อมูลร้านค้า รายการสินค้า และประวัติการสั่งซื้อเพื่อความปลอดภัยของผู้ใช้ทุกฝ่าย</li>
              <li>หากพบการกระทำที่เข้าข่ายทุจริต เช่น ปั่นยอดสั่งซื้อ รีวิวปลอม หรือใช้งานระบบผิดวัตถุประสงค์ แพลตฟอร์มมีสิทธิ์ระงับหรือปิดร้านค้าได้ทันที</li>
              <li>ผู้ขายต้องติดตามการแจ้งเตือนและประกาศอัปเดตจากระบบอย่างสม่ำเสมอ และปรับตัวตามกฎระเบียบใหม่ที่แพลตฟอร์มกำหนด</li>
              <li>การเปิดร้านบน KMALL ถือเป็นการยอมรับว่า คุณเข้าใจและยอมปฏิบัติตามข้อตกลงทั้งหมดนี้ หากฝ่าฝืนอาจมีการระงับการใช้งานหรือดำเนินการตามความเหมาะสม</li>
            </ol>
            <p className="text-xs md:text-sm text-gray-500 pt-2">
              *โปรดเลื่อนอ่านจนสุดเพื่อเปิดใช้งานปุ่ม &quot;ฉันยอมรับ&quot;
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm md:text-base text-gray-700 hover:bg-gray-50"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`rounded-xl px-5 py-2 text-sm md:text-base font-medium text-white ${
                canConfirm
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-orange-300 cursor-not-allowed opacity-70"
              }`}
            >
              ฉันยอมรับ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
