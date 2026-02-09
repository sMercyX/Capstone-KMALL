import { Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import MainLayout from "../components/Layout/MainLayout"
import LoadingSpinner from "../components/LoaingSpinner/LoadingSpinner"
import ProductPage from "../modules/ProductPage/ProductPage"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"
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
const OrderPage = lazy(() => import("../modules/OrderPage/OrderPage"))
const ChatPage = lazy(() => import("../modules/ChatPage/ChatPage"))

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
              path="/store/me"
              element={
                <ProtectedRoute>
                  <StoreSellerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/products"
              element={
                <ProtectedRoute>
                  <StoreSellerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/add"
              element={
                <ProtectedRoute>
                  <StoreSellerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/orders"
              element={
                <ProtectedRoute>
                  <StoreSellerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/orders/:orderId"
              element={
                <ProtectedRoute>
                  <StoreOrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/orders/:orderId/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/settings"
              element={
                <ProtectedRoute>
                  <StoreSellerPage />
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
          </>

          <Route path="*" element={<div>404</div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}
