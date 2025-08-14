import React, { useState, useEffect } from "react"
import CircularGallery from "../../components/CircleGallery/CircleGallery"
import { useNavigate } from "react-router-dom"
// import { ArrowRight, ShoppingBag, Users, Zap, Star, BookOpen, Coffee, Gamepad2 } from 'lucide-react';

const KmallLanding = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState(null)

  const navigate = useNavigate()
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="h-full w-full">
      {/* Header */}
      <header className=" flex justify-between items-center p-6 max-w-7xl mx-auto ">
        <div
          className={`font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`}
        >
          KMALL
        </div>
        <button
          className={`px-6 py-2 text-slate-600 hover:text-slate-900 font-medium transition-all duration-300 hover:scale-105 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
          }`}
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </header>

      {/* Hero Section */}
      <main className="">
        <div className="relative z-10 max-w-7xl mx-auto ">
          <div className="text-center space-y-8">
            {/* Main Title */}
            <div
              className={`space-y-4 transition-all duration-1000 delay-300 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <h1 className="text-6xl md:text-7xl font-bold leading-tight">
                KMALL –
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  KMUTT
                </span>
              </h1>
              <p className="text-2xl md:text-3xl text-slate-600 font-light max-w-3xl mx-auto">
                Marketplace for Students
              </p>
            </div>

            {/* CTA Button */}
            <div
              className={`transition-all duration-1000 delay-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <button
                onClick={() => navigate("/login")}
                className="group relative px-8 py-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-full font-medium text-lg shadow-2xl hover:shadow-slate-500/25 transition-all duration-300 hover:scale-105 hover:from-slate-600 hover:to-slate-800"
              >
                <span className="flex items-center gap-3">
                  Login with KMUTT Email
                  {/* <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" /> */}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>

            <div style={{ height: "600px", position: "relative" }}
             className={`transition-all duration-1000 delay-1200 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <CircularGallery
                bend={0}
                textColor="#ffffff"
                borderRadius={0.05}
                scrollEase={0.02}
                autoPlay={true}
                autoPlaySpeed={0.02}
                pauseOnHover={true}
              />
            </div>
          </div>
        </div>

        {/* Floating Action Elements
        <div className="fixed bottom-8 right-8 z-20">
          <div className="flex flex-col gap-4">
            <button className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/25 flex items-center justify-center hover:scale-110 transition-all duration-300">
              <Zap className="w-6 h-6" />
            </button>
          </div>
        </div> */}
      </main>
    </div>
  )
}

export default KmallLanding

{
  /* Background Elements */
}
{
  /* <div className="absolute overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-600/20 rounded-full blur-3xl"></div>
      </div> */
}
