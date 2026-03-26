import { Outlet } from "react-router-dom"
import Navbar from "../NavBar/NavBar"
import kmallText from "../../assets/kmutt-text.svg"
import { FaInstagram, FaFacebookF, FaFigma, FaGoogle, FaGithub } from "react-icons/fa"

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9f9]">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 md:px-[48px] py-4 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t py-10">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <img src={kmallText} alt="KMALL" className="h-8 w-auto" />

          <nav className="flex gap-6 text-text font-semibold text-gray-700">
            <button className="hover:text-orange-500">Service</button>
            <button className="hover:text-orange-500">Support</button>
            <button className="hover:text-orange-500">Company</button>
            <button className="hover:text-orange-500">Legal</button>
            <button className="hover:text-orange-500">Join Us</button>
          </nav>

          <div className="mt-2 flex gap-3">
            <div className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:-translate-y-0.5 transition">
              <FaInstagram className="text-lg" />
            </div>
            <div className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:-translate-y-0.5 transition">
              <FaFacebookF className="text-lg" />
            </div>
            <div className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:-translate-y-0.5 transition">
              <FaFigma className="text-lg" />
            </div>
            <div className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:-translate-y-0.5 transition">
              <FaGoogle className="text-lg" />
            </div>
            <div className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:-translate-y-0.5 transition">
              <FaGithub className="text-lg" />
            </div>
          </div>

          <p className="mt-2 text-description text-orange-500 font-medium tracking-wide">
            KMALL - KMUTT Marketplace
          </p>
        </div>
      </footer>
    </div>
  )
}
