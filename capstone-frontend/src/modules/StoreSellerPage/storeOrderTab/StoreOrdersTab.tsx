// src/pages/store/StoreOrdersTab.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { SwitchTabItem } from "../../../components/SwitchTabs/SwitchTabs";
import type { OrderStatusGroup } from "../../../api/orderApi";
import { useStoreOrderStore } from "../../../stores/storeOrderStore";
import type { StoreOrderTabKey } from "../../../stores/storeOrderStore";
import type { StoreOrderStatusContext } from "./StoreOrderListItem";
import { useOrderSellerApi } from "../../../api/orderSellerApi";
import StoreOrderListItem from "./StoreOrderListItem";
import SwitchTabs from "../../../components/SwitchTabs/SwitchTabs";
import { useStoreStore } from "../../../stores/storeStore";

const ORDER_TABS: SwitchTabItem[] = [
  { key: "ongoing", label: "ON GOING", href: "/store/orders/ongoing" },
  { key: "completed", label: "COMPLETED", href: "/store/orders/completed" },
  { key: "canceled", label: "CANCELED/FAILED", href: "/store/orders/canceled" },
];

const statusGroupMap: Record<StoreOrderTabKey, OrderStatusGroup> = {
  ongoing: "active",
  completed: "completed",
  canceled: "cancelled",
};

const contextMap: Record<StoreOrderTabKey, StoreOrderStatusContext> = {
  ongoing: "ongoing",
  completed: "completed",
  canceled: "canceled",
};

function getActiveKeyFromPath(pathname: string): StoreOrderTabKey {
  if (pathname.startsWith("/store/orders/completed")) return "completed";
  if (pathname.startsWith("/store/orders/canceled")) return "canceled";
  // default
  return "ongoing";
}

export default function StoreOrdersTab() {
  const {
    orders,
    isLoading,
    error,
    startLoading,
    setOrders,
    setError,
  } = useStoreOrderStore();

  const { getOrdersSellerByStatus } = useOrderSellerApi();
  const { store } = useStoreStore();
  const location = useLocation();
  const pathname = location.pathname;

  const activeKey = getActiveKeyFromPath(pathname);

 

  useEffect(() => {
    if (!store?.id) return;

    const status = statusGroupMap[activeKey];

    startLoading();
    setError(null);

    (async () => {
      try {
        const res = await getOrdersSellerByStatus(store.id, status);
        setOrders(res.data ?? []);
      } catch (e) {
        setError("ไม่สามารถโหลดคำสั่งซื้อของร้านค้าได้");
      }
    })();
  }, [activeKey, store?.id]);

  return (
    <div className="pb-6">
      {/* เส้นคั่น + tabs */}
      <div className="mb-4 border-gray-300 pt-3">
        <SwitchTabs
          tabs={ORDER_TABS} // ใช้โหมด NavLink แบบเดียวกับ StorePage
        />
      </div>

      {/* list */}
      <div className="mt-4 space-y-3">
        {isLoading && (
          <p className="text-center text-sm text-gray-500">กำลังโหลด...</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
        {!isLoading && !error && orders.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            ยังไม่มีคำสั่งซื้อในหมวดนี้
          </p>
        )}
        {!isLoading &&
          !error &&
          orders.map((o) => (
            <StoreOrderListItem
              key={o.order.order_id}
              data={o}
              context={contextMap[activeKey]}
            />
          ))}
      </div>
    </div>
  );
}
