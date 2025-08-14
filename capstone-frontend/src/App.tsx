import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import { ThemeProvider } from "./theme/ThemeContext"
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute"
import Login from "./modules/Login/Login"
import LandingPage from "./modules/LandingPage/LandingPage"
import Dashboard from "./modules/DashBoard/Dashboard"
import "./i18n"
import "./App.css"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                // <ProtectedRoute>
                  <Dashboard />
                // </ProtectedRoute>
              }
            />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
