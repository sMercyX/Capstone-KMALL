import type { OrderItemDetail, orderSellerData, OrderDeliveryAddress } from "../../../api/orderSellerApi"
import type { CampusLocation } from "../../../api/campusLocationApi"
import { ZoneDropdown, BuildingDropdown, DateTimePicker } from "../../../components/Dropdown"
import ProductList from "../../../components/ProductList/ProductList"
import MapKmuttButton from "../../../components/MapKmuttButton/MapKmuttButton"
import { MapPin, Calendar } from "lucide-react"

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
  // Round Uni Props
  deliveryAddress?: OrderDeliveryAddress
  promisedShipDate?: Date | null
  promisedShipTime?: string
  onPromisedShipDateChange?: (date: Date | null, time: string) => void
  promisedShipError?: boolean
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
  deliveryAddress,
  promisedShipDate,
  promisedShipTime,
  onPromisedShipDateChange,
  promisedShipError,
}: PendingProposedPageProps) {
  // No tabs needed anymore
  // const [activeTab, setActiveTab] = useState<"products" | "delivery">("products")

  return (
    <>
      {/* Delivery Details Section */}
      <div className="mb-6">
        {order.delivery_method === "ROUND_UNIVERSITY" ? (
          <div>
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Delivery Address</h3>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
              <div className="flex items-start gap-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                  <MapPin className="h-6 w-6 text-gray-500" />
                </div>
                <div className="flex-1">
                  {deliveryAddress ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 mb-1">{deliveryAddress.label}</p>
                      <p className="text-gray-700 leading-relaxed font-medium">
                        {deliveryAddress.address_line1}, {deliveryAddress.district}, {deliveryAddress.province} {deliveryAddress.postal_code}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-gray-600 bg-gray-50 w-fit px-3 py-1 rounded-lg">
                        <span className="text-xs font-bold uppercase">Phone:</span>
                        <span className="text-sm font-semibold">{deliveryAddress.phone}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">No delivery address provided</p>
                  )}
                </div>
              </div>
            </div>

            {/* Ship Date Selection (For Seller in Pending) */}
            {!isBuyer && order.status === "Pending" && (
              <div className="bg-white rounded-2xl p-6 border-2 border-dashed border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <h4 className="font-bold text-gray-800">Set Promised Shipping Date</h4>
                </div>
                <div className="max-w-md">
                   <DateTimePicker
                      value={promisedShipDate || null}
                      onChange={onPromisedShipDateChange || (() => {})}
                      disabled={false}
                      time={promisedShipTime || "10:00 AM"}
                      minDate={new Date()}
                      maxDate={new Date(new Date().setDate(new Date().getDate() + 14))}
                      error={promisedShipError}
                      label="Pick a date and time for delivery"
                    />
                    {promisedShipError && (
                      <p className="mt-2 text-sm text-red-500 font-medium italic">
                        * Please select a shipping date before accepting
                      </p>
                    )}
                </div>
              </div>
            )}
            
            {/* Display ship date if already proposed/accepted (Read Only) */}
            {order.status !== "Pending" && items[0]?.promised_ship_date && (
               <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-1">Scheduled Delivery</p>
                    <p className="text-lg font-bold text-gray-900">
                      {new Date(items[0].promised_ship_date).toLocaleString('th-TH', { 
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
               </div>
            )}

            {/* Placeholder for buyer in Pending status - Removed as per user request */}
            {isBuyer && order.status === "Pending" && null}
          </div>
        ) : (
          <div>
            {/* Meeting location and date/time (Existing Campus Meeting Flow) */}
            {isBuyer && order.status === "Pending" ? null : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Meeting location and date/time</h3>
                </div>

                {/* Grid: Desktop = Zone+DateTime / Building+MAP, Mobile = Zone → Building → DateTime → MAP */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="order-1">
                    <ZoneDropdown
                      value={selectedZone}
                      onChange={onZoneChange}
                      zones={zones}
                      disabled={isBuyer}
                      error={validationErrors.zone}
                    />
                  </div>

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

                  <div className="order-2 md:order-3">
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

                  <div className="order-4">
                    <label className="block text-base font-semibold mb-3 invisible">-</label>
                    <MapKmuttButton />
                  </div>
                </div>

                {/* Save Button - only show for seller in Proposed status */}
                {!isBuyer && order.status === "Proposed" && (() => {
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
                        ${isDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                      {proposeLoading ? 'Saving...' : 'Save and propose time'}
                    </button>
                  </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
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
