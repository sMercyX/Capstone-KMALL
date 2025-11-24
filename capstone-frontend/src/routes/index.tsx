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
const StorePage = lazy(() => import("../modules/StoreSellerPage/StorePage"))
const StoreRegisterPage = lazy(() => import("../modules/StoreRegisterPage/StoreRegisterPage"))

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
                  {/* <AllowedCategoryRoute> */}
                  <CategoryPage />
                  {/* </AllowedCategoryRoute> */}
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
                  <StorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/products"
              element={
                <ProtectedRoute>
                  <StorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/add"
              element={
                <ProtectedRoute>
                  <StorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/orders"
              element={
                <ProtectedRoute>
                  <StorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/settings"
              element={
                <ProtectedRoute>
                  <StorePage />
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
