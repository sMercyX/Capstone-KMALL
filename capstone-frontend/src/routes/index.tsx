import { Routes, Route } from "react-router-dom"
import { Suspense } from "react"
import KmallLanding from "../modules/LandingPage/LandingPage"
import Welcome from "../modules/Welcome/Welcome"
import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute"
import Dashboard from "../modules/DashBoard/Dashboard"

function NotFound() {
  return <div style={{ padding: 24 }}>404 — Page not found</div>
}

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
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </>

        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  )
}
