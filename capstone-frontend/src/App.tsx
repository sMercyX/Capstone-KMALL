import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import { ThemeProvider } from "./theme/ThemeContext"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import "./i18n"
import "./App.css"
import AppRoutes from "./routes"
import DevModeSwitcher from "./components/DevModeSwitcher/DevModeSwitcher"

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <DevModeSwitcher />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
            style={{ zIndex: 99999 }}
          />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
