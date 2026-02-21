// src/modules/StoreOrderDetailPage/PendingProposedPage/PendingProposedPage.tsx
import type { OrderItemDetail, orderSellerData } from "../../../api/orderSellerApi"
import type { CampusLocation } from "../../../api/campusLocationApi"
import { ZoneDropdown, BuildingDropdown, DateTimePicker } from "../../../components/Dropdown"
import ProductList from "../components/ProductList"
import MapKmuttButton from "../../../components/MapKmuttButton/MapKmuttButton"

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
  isBuyer: boolean
  proposeLoading: boolean
  validationErrors?: { zone?: boolean; building?: boolean; dateTime?: boolean }
  onZoneChange: (zone: string | null) => void
  onBuildingChange: (building: number | null) => void
  onDateTimeChange: (date: Date | null, time: string) => void
  onProposeOrder: () => void
}

export default function PendingProposedPage({
  items,
  order,
  subtotal,
  deliveryFee,
  total,
  zones,
  buildings,
  selectedZone,
  selectedBuilding,
  selectedDateTime,
  selectedTime,
  isBuyer,
  proposeLoading,
  validationErrors = {},
  onZoneChange,
  onBuildingChange,
  onDateTimeChange,
  onProposeOrder,
}: PendingProposedPageProps) {
  // No tabs needed anymore
  // const [activeTab, setActiveTab] = useState<"products" | "delivery">("products")

  return (
    <>
      {/* Delivery Details Section (Moved to top) */}
      <div className="mb-6">
        {/* Header with user */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Meeting location and date/time</h3>
        </div>

        {/* Grid: Desktop = Zone+DateTime / Building+MAP, Mobile = Zone → Building → DateTime → MAP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zone Dropdown - order 1 on all */}
          <div className="order-1">
            <ZoneDropdown
              value={selectedZone}
              onChange={onZoneChange}
              zones={zones}
              disabled={isBuyer}
              error={validationErrors.zone}
            />
          </div>

          {/* DateTime Picker - order 2 on desktop, order 3 on mobile */}
          <div className="order-3 md:order-2">
            <DateTimePicker
              value={selectedDateTime}
              onChange={onDateTimeChange}
              disabled={isBuyer}
              time={selectedTime}
              minDate={new Date()}
              maxDate={new Date(new Date().setDate(new Date().getDate() + 14))}
              error={validationErrors.dateTime}
            />
          </div>

          {/* Building Dropdown - order 3 on desktop, order 2 on mobile */}
          <div className="order-2 md:order-3 mt-0 md:mt-0">
            <BuildingDropdown
              value={selectedBuilding}
              onChange={onBuildingChange}
              buildings={buildings}
              disabled={isBuyer || !selectedZone}
              placeholder={!selectedZone ? "Select a zone first" : "Select a building"}
              label="Building number and name"
              error={validationErrors.building}
            />
          </div>

          {/* MAP KMUTT Button - order 4 on all */}
          <div className="order-4">
            <label className="block text-base font-semibold mb-3 invisible">-</label>
            <MapKmuttButton />
          </div>
        </div>

        {/* Meeting Note Input */}
        {/* <div className="mt-6">
          <label className="block text-base font-semibold mb-3">Additional notes</label>
          <textarea
            value={meetingNoteInput}
            onChange={(e) => onMeetingNoteChange(e.target.value)}
            disabled={isBuyer}
            placeholder="Add any extra details for the meeting..."
            className={`w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-base min-h-[100px] resize-none
              ${isBuyer ? 'cursor-not-allowed opacity-70' : 'focus:border-orange-500 focus:ring-2 focus:ring-orange-100'}`}
          />
        </div> */}

        {/* Save Button - only show for seller in Proposed status */}
        {!isBuyer && order.status === "Proposed" && (() => {
          // Check if any field has changed from the original order
          const originalBuildingId = order.meeting_location_id || order.campus_location_id
          const originalProposedAt = order.proposed_at ? new Date(order.proposed_at) : null

          const hasZoneOrBuildingChanged = selectedBuilding !== originalBuildingId
          const hasDateTimeChanged = selectedDateTime && originalProposedAt
            ? selectedDateTime.getTime() !== originalProposedAt.getTime()
            : selectedDateTime !== originalProposedAt

          const hasChanges = hasZoneOrBuildingChanged || hasDateTimeChanged
          const isDisabled = proposeLoading || !selectedDateTime || !hasChanges

          return (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onProposeOrder}
              disabled={isDisabled}
              className={`px-8 py-3 rounded-xl text-base font-semibold text-white transition-colors
                ${isDisabled
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {proposeLoading ? 'Saving...' : 'Save and propose time'}
            </button>
          </div>
          )
        })()}

        {/* Display existing notes (read-only) */}
        {/* {(order.campus_detail_note || order.meeting_note || order.notes) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Saved notes:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              {order.campus_detail_note && <p>• Pickup point: {order.campus_detail_note}</p>}
              {order.meeting_note && <p>• Meeting: {order.meeting_note}</p>}
              {order.notes && <p>• General: {order.notes}</p>}
            </div>
          </div>
        )} */}
      </div>

      {/* Product Details Section (Moved below Delivery) */}
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-4">Product details</h3>
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
    </>
  )
}
