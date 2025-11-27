// src/components/Order/StoreOrderListItem.tsx
import { Check, Coffee, Loader2, X } from "lucide-react";
import type { orderSellerResponse } from "../../../api/orderSellerApi";

export type StoreOrderStatusContext = "ongoing" | "completed" | "canceled";

interface Props {
  data: orderSellerResponse;
  context: StoreOrderStatusContext;
  onClick?: () => void;
}

function StatusBadge({ context }: { context: StoreOrderStatusContext }) {
  if (context === "ongoing") {
    return (
      <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white text-[10px] shadow">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  if (context === "completed") {
    return (
      <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px] shadow">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span className="absolute -bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow">
      <X className="h-3 w-3" />
    </span>
  );
}

function mapStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "กำลังดำเนินการ",
    ACTIVE: "กำลังดำเนินการ",
    COMPLETED: "เสร็จสิ้น",
    CANCELLED: "ยกเลิกแล้ว",
  };
  return map[status] ?? status;
}

export default function StoreOrderListItem({
  data,
  context,
  onClick,
}: Props) {
  const { order, buyer_display_name, buyer_email } = data;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm hover:shadow-md transition">
        {/* icon + badge */}
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200">
            <Coffee className="h-7 w-7 text-gray-700" />
          </div>
          <StatusBadge context={context} />
        </div>

        {/* text */}
        <div className="flex-1 text-sm md:text-base text-gray-800">
          <div className="font-semibold">
            ชื่อผู้ซื้อ {buyer_display_name}
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            ช่องทางติดต่อ {buyer_email}
          </div>
          <div className="text-xs md:text-sm mt-1">
            สถานะ {mapStatusLabel(order.status)}
          </div>
        </div>
      </div>
    </button>
  );
}
