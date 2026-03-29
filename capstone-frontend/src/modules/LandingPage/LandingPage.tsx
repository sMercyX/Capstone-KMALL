import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import LandingCarousel from "../../components/Carousel/LandingCarousel"
import AgreementModal from "../../components/Policies/AgreementModal"
import { useAuth } from "../../auth/AuthContext"
import kmallLogo from "../../assets/kmutt.svg"
import kmallText from "../../assets/kmutt-text.svg"

const LandingPage = () => {
  const navigate = useNavigate()
  const { user, ready, login } = useAuth()
  const [isAgreementOpen, setIsAgreementOpen] = useState(false)

  useEffect(() => {
    console.log("[Landing] ready/user:", ready, user)
    if (!ready) return
    if (user) {
      navigate("/dashboard", { replace: true })
    }
  }, [ready, user, navigate])

  const goLogin = () => {
    login()
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center">
      {/* Header */}
      <header className="flex justify-between items-center p-6 w-full fixed top-0 z-50 bg-white/80 backdrop-blur-sm max-w-7xl">
         <div className="flex items-center gap-3">
                <img
                  src={kmallText}
                  alt="KMALL"
                className="h-8 w-auto"
                />
            <div className="w-px h-8 bg-orange-500" />
                <img
                    src={kmallLogo}
                    alt="KMALL"
                    className="h-8 w-8"
                    style={{
                    filter:
                        "invert(44%) sepia(94%) saturate(3561%) hue-rotate(5deg) brightness(101%) contrast(101%)",
                }}
            />
            </div>
        <button
          className="px-6 py-2 bg-gray-50/80 border border-gray-100 text-gray-800 font-bold text-xs rounded-full shadow-sm transition-all duration-300 hover:shadow-md hover:bg-white hover:scale-105 cursor-pointer"
          onClick={() => setIsAgreementOpen(true)}
        >
          KMALL Terms of Use
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-start pt-24 md:pt-24 flex-grow w-full">
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-7xl md:text-8xl font-[900] leading-none tracking-tight text-gray-900">
              KMALL,
            </h1>
            <p className="text-2xl md:text-3xl text-gray-500 font-bold max-w-3xl mx-auto">
              KMUTT Marketplace for Students
            </p>
          </div>

          <div className="transition-all duration-1000 delay-700">
            <button
              onClick={goLogin}
              className="group relative px-10 py-4 bg-gradient-to-r from-[#ff9b6a] to-[#ff5a36] text-white rounded-full font-bold text-sm shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 transition-all duration-300 hover:scale-110 cursor-pointer active:scale-95"
            >
              <span className="flex items-center gap-2">
                LOGIN WITH MICROSOFT 365 →
              </span>
            </button>
          </div>
        </div>

        <div
          style={{ width: "100vw", position: "relative" }}
          className="transition-all duration-1000 delay-1000 mb-10"
        >
          <LandingCarousel />
        </div>
      </main>

      <AgreementModal 
        open={isAgreementOpen} 
        onClose={() => setIsAgreementOpen(false)}
      />
    </div>
  );
};

export default LandingPage;
