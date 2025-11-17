import { Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"
import MainLayout from "../components/Layout/MainLayout"
import LoadingSpinner from "../components/LoaingSpinner/LoadingSpinner"
import ProductPage from "../modules/ProductPage/ProductPage"

function NotFound() {
  return <div style={{ padding: 24 }}>404 — Page not found</div>
}
const Dashboard = lazy(() => import("../modules/DashBoard/Dashboard"))
const KmallLanding = lazy(() => import("../modules/LandingPage/LandingPage"))
const Welcome = lazy(() => import("../modules/Welcome/Welcome"))
const CategoryPage = lazy(() => import("../modules/CategoryPage/CategoryPage"))
const StoreView = lazy(() => import("../modules/StoreView/StoreView"))


export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <>
          <Route path="/" element={<KmallLanding />} />
          <Route path="/welcome" element={<Welcome />} />
        
          
        </>

        <Route element={<MainLayout />}>
          {/* publicRoutes */}
          <>
            <Route path="/" element={<KmallLanding />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/store/:id" element={<StoreView />} />

          
          </>
          {/* privateRoutes */}
          <>
            <Route
              path="/dashboard"
              element={
                //   <ProtectedRoute>
                <Dashboard />
                //   </ProtectedRoute>
              }
            />
          </>

          <Route path="*" element={<div>404</div>} />
        </Route>
        
      </Routes>
    </Suspense>
  )
}
