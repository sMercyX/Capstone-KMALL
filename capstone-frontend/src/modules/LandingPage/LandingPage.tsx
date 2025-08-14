import React, { useState, useEffect } from "react"
import CircularGallery from "../../components/CircleGallery/CircleGallery"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitch from "../../components/LanguageSwitch/LanguageSwitch"
// import { ArrowRight, ShoppingBag, Users, Zap, Star, BookOpen, Coffee, Gamepad2 } from 'lucide-react';

const KmallLanding = () => {
  const [isVisible, setIsVisible] = useState(false)
  const { t } = useTranslation()
  const navigate = useNavigate()
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="h-screen w-full flex flex-col justify-center items-center">
      {/* Header */}
      <header className="flex justify-between items-center p-6 max-w-7xl w-full">
        <div
          className={`font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`}
        >
          KMALL
        </div>
        <>
          <button
            className={`px-6 py-2 text-slate-600 hover:text-slate-900 font-medium transition-all duration-300 hover:scale-105 ${
              isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8"
            }`}
            onClick={() => navigate("/login")}
          >
            {t("login:login")}
          </button>
        </>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center flex-1 w-full">
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
              KMALL –{" "}
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
                 {t("login:loginMicrosoft")}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>

        {/* Circular Gallery */}
        <div
          style={{ width: "100vw", height: "40vh", position: "relative" }}
          className={`transition-all duration-1000 delay-1200 mt-12 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <CircularGallery
            bend={0}
            textColor="#ffffff"
            borderRadius={0.05}
            scrollEase={0.02}
            autoPlay={true}
            autoPlaySpeed={0.05}
            pauseOnHover={true}
          />
        </div>
      </main>
    </div>
  )
}

export default KmallLanding

{
  /* Background Elements */
}
{
}
