import { Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"

function NotFound() {
  return <div style={{ padding: 24 }}>404 — Page not found</div>
}
const Dashboard = lazy(() => import("../modules/DashBoard/Dashboard"))
const KmallLanding = lazy(() => import("../modules/LandingPage/LandingPage"))
const Welcome = lazy(() => import("../modules/Welcome/Welcome"))

export default function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <Routes>
        {/* publicRoutes */}
        <>
          <Route path="/" element={<KmallLanding />} />
          <Route path="/welcome" element={<Welcome />} />
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
      </Routes>
    </Suspense>
  )
}
