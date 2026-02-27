import { useLocation, useNavigate } from "react-router-dom"
import Card from "../../components/Card/Card"
import StoreInfoTab from "./StoreInfoTab/StoreInfoTab"
import StoreOrdersTab from "./storeOrderTab/StoreOrdersTab"
import StoreSettingsTab from "./StoreSettingTab"
import { StoreAddTab } from "./StoreAddTab/StoreAddTab"
import StoreProductsTab from "./StoreProductsTab/StoreProductsTab"
import { useUserStore } from "../../stores/userStore"
import { useStoreStore } from "../../stores/storeStore"
import { useEffect } from "react"

type StoreTabKey = "store" | "products" | "add" | "orders" | "settings"

export default function StorePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname

  // Tabs configuration removed since we now use BackendLayout sidebar

  // ✅ ตรงนี้คือจุดสำคัญ — ดูจาก URL แล้วแมปเป็น key
  let activeKey: StoreTabKey = "store"
  if (pathname.startsWith("/store/me")) activeKey = "store"
  else if (pathname.startsWith("/store/products")) activeKey = "products"
  else if (pathname.startsWith("/store/add")) activeKey = "add"
  else if (pathname.startsWith("/store/orders")) activeKey = "orders"
  else if (pathname.startsWith("/store/settings")) activeKey = "settings"
  // ถ้าไม่ตรงอะไรเลย (เช่น /store) ก็เป็น "store"

  let activeLabel = "My Store"
  if (activeKey === "products") activeLabel = "Products"
  else if (activeKey === "add") activeLabel = "Add New Product"
  else if (activeKey === "orders") activeLabel = "Orders"
  else if (activeKey === "settings") activeLabel = "Store Settings"

  const roles = useUserStore((s) => s.roles)
  // 🔒 ถ้ามี role seller อยู่แล้ว ห้ามเข้าหน้านี้ → เด้งไป /store/me
  const hasSellerRole = !roles?.some((r) => r.toLowerCase() === "seller")

  const { store, fetchStore } = useStoreStore()

  useEffect(() => {
    if (hasSellerRole) {
      navigate("/store/register", { replace: true })
    }
  }, [hasSellerRole, navigate])

  // Fetch store if not loaded
  useEffect(() => {
    if (!store?.id) {
      fetchStore()
    }
  }, [store?.id, fetchStore])

  return (
    <div className="max-w-6xl mx-auto py-10">
      <Card className="space-y-5">
        <h1 className="text-center text-3xl font-bold  text-black">
          {activeLabel}
        </h1>

        {activeKey === "store" && <StoreInfoTab />}
        {activeKey === "products" && <StoreProductsTab />}
        {activeKey === "add" && <StoreAddTab />}
        {activeKey === "orders" && <StoreOrdersTab />}
        {activeKey === "settings" && <StoreSettingsTab />}
      </Card>
    </div>
  )
}
