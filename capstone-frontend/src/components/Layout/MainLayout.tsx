import { Outlet } from "react-router-dom"
import Navbar from "../NavBar/NavBar"

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1  mx-auto w-full px-[48px] py-10">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} KMALL
      </footer>
    </div>
  )
}
