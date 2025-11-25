import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import { ThemeProvider } from "./theme/ThemeContext"
import "./i18n"
import "./App.css"
import AppRoutes from "./routes"

export default function App() {
  return (
    <BrowserRouter basename="/capstone25/cp25ssa2">
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
