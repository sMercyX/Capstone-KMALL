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
    if (!ready) return
    if (user) {
      navigate("/dashboard", { replace: true })
    }
  }, [ready, user, navigate])

  const goLogin = () => {
    login()
  }

  return (
    <div className="h-screen w-full flex flex-col items-center bg-white overflow-hidden text-[#111822]">
      {/* Header - Minimalist Style matching Image 2 */}
      <header className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 w-full fixed top-0 z-50 bg-white/30 backdrop-blur-md max-w-7xl">
         <div className="flex items-center gap-2 sm:gap-3">
                <img
                  src={kmallText}
                  alt="KMALL"
                className="h-5 sm:h-7 w-auto"
                />
            <div className="w-[1.5px] h-5 sm:h-7 bg-orange-500/80" />
                <img
                    src={kmallLogo}
                    alt="KMALL"
                    className="h-5 sm:h-7 w-5 sm:w-7"
                    style={{
                    filter:
                        "invert(44%) sepia(94%) saturate(3561%) hue-rotate(5deg) brightness(101%) contrast(101%)",
                }}
            />
            </div>
        <button
          className="px-4 py-1.5 sm:px-5 sm:py-2 bg-gray-100/60 border border-gray-200/50 text-gray-700 font-semibold text-[9px] sm:text-[11px] rounded-full shadow-sm transition-all duration-300 hover:bg-white/80 cursor-pointer text-center"
          onClick={() => setIsAgreementOpen(true)}
        >
          KMALL Terms of Use
        </button>
      </header>

      {/* Hero Section - Repositioned higher to fix standard Mac viewports */}
      <main className="flex flex-col items-center justify-center sm:justify-start w-full h-full pt-16 sm:pt-32 lg:pt-44 gap-y-6 sm:gap-y-0">
        {/* Content Block */}
        <div className="flex flex-col items-center text-center px-6">
          <div className="mb-4 sm:mb-8">
            <h1 className="text-4xl sm:text-[78px] lg:text-[88px] font-black leading-tight tracking-tight mb-1 sm:mb-2 uppercase">
              KMALL,
            </h1>
            <p className="text-[10px] sm:text-lg lg:text-[28px] text-[#2D3139] font-bold tracking-tight uppercase">
              KMUTT Marketplace for Students
            </p>
          </div>

          <div className="mt-1 sm:mt-4">
            <button
              onClick={goLogin}
              style={{
                background: "linear-gradient(135deg, #FFBD95 0%, #FF856D 100%)",
              }}
              className="px-8 py-2.5 sm:px-14 sm:py-4 text-gray-900 rounded-full font-bold text-xs sm:text-base shadow-xl shadow-orange-200/50 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 border border-white/20"
            >
              LOGIN WITH MICROSOFT 365 →
            </button>
          </div>
        </div>

        {/* Dense Carousel Area matching Image 2 - Consistent height with better desktop spacing */}
        <div className="w-full h-[40vh] sm:h-[48vh] lg:h-[50vh] pb-8 sm:pb-12 sm:mt-auto">
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
