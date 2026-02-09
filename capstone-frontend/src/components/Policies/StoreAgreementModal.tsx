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
            Store Opening Agreement
            </h2>
            <p className="mt-2 text-sm md:text-base text-gray-600">
              Please read and accept the terms and conditions for becoming a seller on the KMALL platform.
            </p>
          </div>

          {/* เนื้อหาที่ต้องเลื่อนอ่าน */}
          <div
            className="max-h-80 md:max-h-96 overflow-y-auto pr-2 text-sm md:text-base text-gray-700 space-y-3 border rounded-xl px-4 py-3 bg-gray-50"
            onScroll={handleScroll}
          >
            <p>By opening a store on KMALL, you agree to comply with the following terms:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>All products must comply with applicable laws, must not infringe intellectual property rights, and must not be prohibited under KMUTT regulations or Thai law.</li>
              <li>Product information, prices, promotions, and stock availability must be accurate and must not be misleading to buyers.</li>
              <li>Sellers are responsible for delivering products on time as stated, including proper and safe packaging.</li>
              <li>In the event of issues such as damaged items, incorrect shipments, or missing items, sellers must cooperate in resolving the issue and provide appropriate after-sales support.</li>
              <li>Selling alcohol, illegal drugs, weapons, pornographic materials, or any items that violate morality or KMUTT/KMALL policies is strictly prohibited.</li>
              <li>Sellers must not misuse buyer information, such as using contact details for marketing purposes without consent.</li>
              <li>Sellers agree that the KMALL team may review store information, product listings, and order history to ensure user safety.</li>
              <li>If fraudulent behavior is detected (e.g., order manipulation, fake reviews, or misuse of the system), the platform reserves the right to suspend or close the store immediately.</li>
              <li>Sellers must regularly review notifications and announcements and comply with any updated rules and policies issued by the platform.</li>
              <li>Opening a store on KMALL indicates that you understand and accept all terms above. Violations may result in account suspension or other actions as appropriate.</li>
            </ol>
            <p className="text-xs md:text-sm text-gray-500 pt-2">
              *Please scroll to the bottom to enable the &quot;I Agree&quot; button.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm md:text-base text-gray-700 hover:bg-gray-50"
            >
              Close
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
              I Agree
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
