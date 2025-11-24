import { Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import MainLayout from "../components/Layout/MainLayout"
import LoadingSpinner from "../components/LoaingSpinner/LoadingSpinner"
import ProductPage from "../modules/ProductPage/ProductPage"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"
import AllowedCategoryRoute from "../modules/CategoryPage/AllowedCategoryRoute"

// function NotFound() {
//   return <div style={{ padding: 24 }}>404 — Page not found</div>
// }
const Dashboard = lazy(() => import("../modules/DashBoard/Dashboard"))
const LandingPage = lazy(() => import("../modules/LandingPage/LandingPage"))
const CategoryPage = lazy(() => import("../modules/CategoryPage/CategoryPage"))
const StoreView = lazy(() => import("../modules/StoreView/StorePage"))
const CartPage = lazy(() => import("../modules/CartPage/CartPage"))


export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <>
          <Route path="/" element={<LandingPage />} />
        </>

        <Route element={<MainLayout />}>
          {/* publicRoutes */}
          <>
            <Route path="/dashboard2" element={<Dashboard />} />
            <Route path="/store/:id" element={<StoreView />} />
            <Route path="/cart" element={<CartPage />} />
          </>
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
              path="/category/:category"
              element={
                <ProtectedRoute>
                  <AllowedCategoryRoute>
                    <CategoryPage />
                  </AllowedCategoryRoute>
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
          </>

          <Route path="*" element={<div>404</div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}
