import { useLocation, useNavigate } from "react-router-dom"
import Card from "../../components/Card/Card"
import SwitchTabs, {
  type SwitchTabItem,
} from "../../components/SwitchTabs/SwitchTabs"
import StoreInfoTab from "./StoreInfoTab/StoreInfoTab"
import StoreOrdersTab from "./StoreOrdersTab"
import StoreSettingsTab from "./StoreSettingTab"
import { StoreAddTab } from "./StoreAddTab/StoreAddTab"
import StoreProductsTab from "./StoreProductsTab/StoreProductsTab"
import { useUserStore } from "../../stores/userStore"
import { useEffect } from "react"

type StoreTabKey = "store" | "products" | "add" | "orders" | "settings"

export default function StorePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname

  const tabs: SwitchTabItem[] = [
    { key: "store", label: "ร้านค้าของฉัน", href: "/store/me" },
    { key: "products", label: "สินค้า", href: "/store/products" },
    { key: "add", label: "เพิ่มผลิตภัณฑ์ใหม่", href: "/store/add" },
    { key: "orders", label: "คำสั่งซื้อ", href: "/store/orders" },
    { key: "settings", label: "การตั้งค่าร้านค้า", href: "/store/settings" },
  ]

  // ✅ ตรงนี้คือจุดสำคัญ — ดูจาก URL แล้วแมปเป็น key
  let activeKey: StoreTabKey = "store"
  if (pathname.startsWith("/store/me")) activeKey = "store"
  else if (pathname.startsWith("/store/products")) activeKey = "products"
  else if (pathname.startsWith("/store/add")) activeKey = "add"
  else if (pathname.startsWith("/store/orders")) activeKey = "orders"
  else if (pathname.startsWith("/store/settings")) activeKey = "settings"
  // ถ้าไม่ตรงอะไรเลย (เช่น /store) ก็เป็น "store"

  const activeLabel =
    tabs.find((t) => t.key === activeKey)?.label || "ร้านค้าของฉัน"

  const roles = useUserStore((s) => s.roles)
  // 🔒 ถ้ามี role seller อยู่แล้ว ห้ามเข้าหน้านี้ → เด้งไป /store/me
  const hasSellerRole = !roles?.some((r) => r.toLowerCase() === "seller")

  useEffect(() => {
    if (hasSellerRole) {
      navigate("/store/register", { replace: true })
    }
  }, [hasSellerRole, navigate])

  return (
    <div className="max-w-6xl mx-auto py-10">
      <Card className="space-y-5">
        <SwitchTabs tabs={tabs} />
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
