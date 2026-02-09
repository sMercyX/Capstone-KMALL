// src/pages/store/StoreOrdersTab.tsx
import { useEffect, useState } from "react";
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
  { key: "ongoing", label: "ON GOING" },
  { key: "completed", label: "COMPLETED" },
  { key: "canceled", label: "CANCELED/FAILED" },
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
  
  // ใช้ internal state แทน URL routing
  const [activeKey, setActiveKey] = useState<StoreOrderTabKey>("ongoing");

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
        setError("Unable to load store orders.");
      }
    })();
  }, [activeKey, store?.id]);

  return (
    <div className="pb-6">
      {/* เส้นคั่น + tabs */}
      <div className="mb-4 border-gray-300 pt-3">
        <SwitchTabs
          tabs={ORDER_TABS} 
          useNavLink={false}
          activeKey={activeKey}
          onChange={(key) => setActiveKey(key as StoreOrderTabKey)}
        />
      </div>

      {/* list */}
      <div className="mt-4 space-y-3">
        {isLoading && (
          <p className="text-center text-sm text-gray-500">Loading...</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
        {!isLoading && !error && orders.length === 0 && (
          <p className="text-center text-sm text-gray-500">
             No orders in this category yet.
          </p>
        )}
        {!isLoading &&
          !error &&
          orders.map((o) => (
            <StoreOrderListItem
              key={o.order.id}
              data={o}
              context={contextMap[activeKey]}
            />
          ))}
      </div>
    </div>
  );
}
