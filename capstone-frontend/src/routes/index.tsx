import { Routes, Route, Navigate } from "react-router-dom"
import { lazy, Suspense } from "react"
import MainLayout from "../components/Layout/MainLayout"
import LoadingSpinner from "../components/LoaingSpinner/LoadingSpinner"
import ProductPage from "../modules/ProductPage/ProductPage"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"
import ProtectedRoleRoute from "../components/ProtectedRoute/ProtectedRoleRoute"
// import AllowedCategoryRoute from "../modules/CategoryPage/AllowedCategoryRoute"

// function NotFound() {
//   return <div style={{ padding: 24 }}>404 — Page not found</div>
// }
const Dashboard = lazy(() => import("../modules/DashBoard/Dashboard"))
const LandingPage = lazy(() => import("../modules/LandingPage/LandingPage"))
const CategoryPage = lazy(() => import("../modules/CategoryPage/CategoryPage"))
const SearchPage = lazy(() => import("../modules/SearchPage/SearchPage"))

const StorePage = lazy(() => import("../modules/StorePage/StorePage"))
const StoreSellerPage = lazy(
  () => import("../modules/StoreSellerPage/StorePage")
)
const StoreRegisterPage = lazy(
  () => import("../modules/StoreRegisterPage/StoreRegisterPage")
)
const CartPage = lazy(() => import("../modules/CartPage/CartPage"))
const CheckoutPage = lazy(() => import("../modules/CheckoutPage/CheckoutPage"))
const StoreOrderDetailPage = lazy(
  () => import("../modules/StoreOrderDetailPage/StoreOrderDetailPage")
)
const StoreReportStatusPage = lazy(
  () => import("../modules/StoreSellerPage/StoreReportStatusPage")
)
const OrderPage = lazy(() => import("../modules/OrderPage/OrderPage"))
const BuyerReportStatusPage = lazy(
  () => import("../modules/ReportPage/BuyerReportStatusPage")
)
const ChatPage = lazy(() => import("../modules/ChatPage/ChatPage"))

// --- Backend (Admin / Seller) Setup ---
import BackendLayout from "../components/Layout/BackendLayout"
import {
  FaCoins,
  FaUserLock,
  FaUser,
  FaBox,
  FaHandHoldingUsd,
  FaCog,
  FaHome
} from "react-icons/fa"
import { PiWarningCircleBold } from "react-icons/pi"

const AdminCategoryPage = lazy(() => import("../modules/AdminPage/CategoryPage/CategoryPage"))
const AdminAddCategoryPage = lazy(() => import("../modules/AdminPage/CategoryPage/AddEditCategoryPage"))
const AdminSellerReportPage = lazy(() => import("../modules/AdminPage/SellerReportPage/SellerReportPage"))
const AdminBuyerReportPage = lazy(() => import("../modules/AdminPage/BuyerReportPage/BuyerReportPage"))
const AdminReportDetailPage = lazy(() => import("../modules/AdminPage/ReportDetailPage/ReportDetailPage"))
const BlacklistedStoresPage = lazy(() => import("../modules/AdminPage/BlacklistPage/BlacklistedStoresPage"))
const BlacklistedBuyersPage = lazy(() => import("../modules/AdminPage/BlacklistPage/BlacklistedBuyersPage"))

const adminMenuItems = [
  {
    label: "Category",
    icon: <FaCoins />,
    path: "/admin/category"
  },
  {
    label: "Report",
    icon: <PiWarningCircleBold />,
    subItems: [
      { label: "Reported by Seller", path: "/admin/report/seller" },
      { label: "Reported by Buyer", path: "/admin/report/buyer" }
    ]
  },
  {
    label: "Blacklist",
    icon: <FaUserLock />,
    subItems: [
      { label: "Blacklisted Stores", path: "/admin/blacklist/stores" },
      { label: "Blacklisted Buyers", path: "/admin/blacklist/buyers" }
    ]
  }
]

const sellerMenuItems = [
  { label: "Dashboard", icon: <FaHome />, path: "/store/dashboard" },
  { label: "My Store", icon: <FaUser />, path: "/store/me" },
  { label: "Products", icon: <FaBox />, path: "/store/products" },
  { label: "Orders", icon: <FaHandHoldingUsd />, path: "/store/orders" },
  { label: "Report", icon: <PiWarningCircleBold />, path: "/store/report" },
  { label: "Store Settings", icon: <FaCog />, path: "/store/settings" }
]

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <>
          <Route path="/" element={<LandingPage />} />
        </>

        <Route element={<MainLayout />}>
          {/* publicRoutes */}
          <></>
          {/* privateRoutes */}
          <>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* dashboard and store pages moved to BackendLayout */}
            <Route
              path="/categories/:category"
              element={
                <ProtectedRoute>
                  {/* <AllowedCategoryRoute> */}
                  <CategoryPage />
                  {/* </AllowedCategoryRoute> */}
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product/:id"
              element={
                <ProtectedRoute>
                  <ProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/:id"
              element={
                <ProtectedRoute>
                  <StorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/register"
              element={
                <ProtectedRoute>
                  <StoreRegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <CartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/ongoing"
              element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/completed"
              element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/canceled"
              element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:orderId"
              element={
                <ProtectedRoute>
                  <StoreOrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:orderId/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <BuyerReportStatusPage />
                </ProtectedRoute>
              }
            />
          </>

          <Route path="*" element={<div>404</div>} />
        </Route>

        {/* --- GLOBAL BACKEND ROUTES (Admin Layout) --- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoleRoute allowedRoles={["ADMIN"]}>
              <BackendLayout title="Admin Panel" menuItems={adminMenuItems} />
            </ProtectedRoleRoute>
          }
        >
          {/* Admin Sub-routes */}
          <Route path="" element={<Navigate to="/admin/category" replace />} />
          <Route path="category" element={<AdminCategoryPage />} />
          <Route path="category/add" element={<AdminAddCategoryPage />} />
          <Route path="category/edit/:categoryname" element={<AdminAddCategoryPage />} />
          <Route path="report/seller" element={<AdminSellerReportPage />} />
          <Route path="report/buyer" element={<AdminBuyerReportPage />} />
          <Route path="report/:type/:reportId" element={<AdminReportDetailPage />} />
          <Route path="blacklist/stores" element={<BlacklistedStoresPage />} />
          <Route path="blacklist/buyers" element={<BlacklistedBuyersPage />} />
        </Route>

        {/* --- GLOBAL SELLER ROUTES (Store Layout) --- */}
        <Route
          element={
            <ProtectedRoleRoute allowedRoles={["SELLER"]}>
              <BackendLayout menuItems={sellerMenuItems} />
            </ProtectedRoleRoute>
          }
        >
          {/* Seller Sub-routes */}
          <Route path="/store" element={<Navigate to="/store/me" replace />} />
          <Route path="/store/me" element={<StoreSellerPage />} />
          <Route path="/store/products" element={<StoreSellerPage />} />
          <Route path="/store/add" element={<StoreSellerPage />} />
          <Route path="/store/orders" element={<StoreSellerPage />} />
          <Route path="/store/orders/:orderId" element={<StoreOrderDetailPage />} />
          <Route path="/store/orders/:orderId/chat" element={<ChatPage />} />
          <Route path="/store/report" element={<StoreReportStatusPage />} />
          <Route path="/store/settings" element={<StoreSellerPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

