import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import { ThemeProvider } from "./theme/ThemeContext"
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute"
import LandingPage from "./modules/LandingPage/LandingPage"
import Dashboard from "./modules/DashBoard/Dashboard"
import "./i18n"
import "./App.css"
import Welcome from "./modules/Welcome/Welcome"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
