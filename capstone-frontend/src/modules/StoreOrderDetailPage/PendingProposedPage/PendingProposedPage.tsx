// src/modules/StoreOrderDetailPage/PendingProposedPage/PendingProposedPage.tsx
import { useState } from "react"
import type { OrderItemDetail, orderSellerData } from "../../../api/orderSellerApi"
import type { CampusLocation } from "../../../api/campusLocationApi"
import SwitchTabs from "../../../components/SwitchTabs/SwitchTabs"
import { ZoneDropdown, BuildingDropdown, DateTimePicker } from "../../../components/Dropdown"
import ProductList from "../components/ProductList"

interface PendingProposedPageProps {
  items: OrderItemDetail[]
  order: orderSellerData
  subtotal: number
  deliveryFee: number
  total: number
  // Delivery props
  buyerDisplayName?: string
  zones: string[]
  buildings: CampusLocation[]
  selectedZone: string | null
  selectedBuilding: number | null
  selectedDateTime: Date | null
  selectedTime: string
  meetingNoteInput: string
  isBuyer: boolean
  proposeLoading: boolean
  onZoneChange: (zone: string | null) => void
  onBuildingChange: (building: number | null) => void
  onDateTimeChange: (date: Date | null, time: string) => void
  onMeetingNoteChange: (note: string) => void
  onProposeOrder: () => void
}

export default function PendingProposedPage({
  items,
  order,
  subtotal,
  deliveryFee,
  total,
  buyerDisplayName,
  zones,
  buildings,
  selectedZone,
  selectedBuilding,
  selectedDateTime,
  meetingNoteInput,
  isBuyer,
  proposeLoading,
  onZoneChange,
  onBuildingChange,
  onDateTimeChange,
  onMeetingNoteChange,
  onProposeOrder,
}: PendingProposedPageProps) {
  const [activeTab, setActiveTab] = useState<"products" | "delivery">("products")

  return (
    <>
      {/* Tabs */}
      <div className="mb-6">
        <SwitchTabs
          useNavLink={false}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "products" | "delivery")}
          tabs={[
            { key: "products", label: "รายละเอียดสินค้า" },
            { key: "delivery", label: "รายละเอียดการจัดส่ง" },
          ]}
        />
      </div>

      {/* Tab Content: Product Details */}
      {activeTab === "products" && (
        <div className="mb-6">
          <ProductList
            items={items}
            total={total}
            notes={order.notes}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            showHeader={false}
            showNotes={true}
            showBreakdown={true}
          />
        </div>
      )}

    {/* Tab Content: Delivery Details */}
    {activeTab === "delivery" && (
      <div className="mb-6">
        {/* Header with user */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">เลือกสถานที่ วัน/เวลานัดรับสินค้า</h3>
          <div className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded-full">
            <span className="text-lg">✈️</span>
            <span className="font-medium text-gray-700">{buyerDisplayName || "User"}</span>
          </div>
        </div>

        {/* Row 1: Zone + DateTime */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zone Dropdown */}
          <div>
            <ZoneDropdown
              value={selectedZone}
              onChange={onZoneChange}
              zones={zones}
              disabled={isBuyer}
            />
          </div>

          {/* DateTime Picker */}
          <div>
            <DateTimePicker
              value={selectedDateTime}
              onChange={onDateTimeChange}
              disabled={isBuyer}
            />
          </div>
        </div>

        {/* Row 2: Building + MAP Button */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Building Dropdown */}
          <div>
            <BuildingDropdown
              value={selectedBuilding}
              onChange={onBuildingChange}
              buildings={buildings}
              disabled={isBuyer || !selectedZone}
              placeholder={!selectedZone ? "เลือก Zone ก่อน" : "เลือกอาคาร"}
              label="หมายเลขตึก และชื่อตึก"
            />
          </div>

          {/* MAP KMUTT Button */}
          <div>
            <label className="block text-base font-semibold mb-3 invisible">-</label>
            <a
              href="https://maps.kmutt.ac.th/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-4 bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors font-semibold"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white">
                MAP KMUTT
              </span>
            </a>
          </div>
        </div>

        {/* Meeting Note Input */}
        <div className="mt-6">
          <label className="block text-base font-semibold mb-3">หมายเหตุเพิ่มเติม</label>
          <textarea
            value={meetingNoteInput}
            onChange={(e) => onMeetingNoteChange(e.target.value)}
            disabled={isBuyer}
            placeholder="ระบุหมายเหตุเพิ่มเติมสำหรับการนัดหมาย..."
            className={`w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-base min-h-[100px] resize-none
              ${isBuyer ? 'cursor-not-allowed opacity-70' : 'focus:border-orange-500 focus:ring-2 focus:ring-orange-100'}`}
          />
        </div>

        {/* Save Button - only show for seller in Proposed status */}
        {!isBuyer && order.status === "Proposed" && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onProposeOrder}
              disabled={proposeLoading || !selectedDateTime}
              className={`px-8 py-3 rounded-xl text-base font-semibold text-white transition-colors
                ${proposeLoading || !selectedDateTime
                  ? 'bg-orange-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {proposeLoading ? 'กำลังบันทึก...' : 'บันทึกและเสนอวันเวลา'}
            </button>
          </div>
        )}

        {/* Display existing notes (read-only) */}
        {(order.campus_detail_note || order.meeting_note || order.notes) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">หมายเหตุที่บันทึกไว้:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              {order.campus_detail_note && <p>• จุดรับ: {order.campus_detail_note}</p>}
              {order.meeting_note && <p>• นัดหมาย: {order.meeting_note}</p>}
              {order.notes && <p>• หมายเหตุทั่วไป: {order.notes}</p>}
            </div>
          </div>
        )}
      </div>
    )}
    </>
  )
}
