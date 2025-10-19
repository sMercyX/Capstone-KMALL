import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/AuthContext"

type Phase = "loading" | "success"

export default function Welcome() {
  const { ready, user, ensureFreshToken } = useAuth()
  const [phase, setPhase] = useState<Phase>("loading")
  const navigate = useNavigate()

  useEffect(() => {
    let t1: number | null = null
    let t2: number | null = null

    ;(async () => {
      // ให้แน่ใจว่า token พร้อม (จะ refresh ให้เองถ้าจำเป็น)
      const tok = await ensureFreshToken()

      // ถ้า init แล้วแต่ไม่มี token → กลับหน้าแรก
      if (ready && !tok) {
        navigate("/", { replace: true })
        return
      }

      // เล่นแอนิเมชัน: หมุน → ติ๊กถูก → ไป dashboard
      t1 = window.setTimeout(() => setPhase("success"), 1200) // เวลา "หมุน"
      t2 = window.setTimeout(
        () => navigate("/dashboard", { replace: true }),
        2800
      )
    })()

    return () => {
      if (t1) window.clearTimeout(t1)
      if (t2) window.clearTimeout(t2)
    }
  }, [ready, ensureFreshToken, navigate])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start pt-16">
      <h2 className="text-2xl md:text-3xl font-semibold text-slate-700 mb-6">
        KMALL – KMUTT Marketplace
      </h2>

      {/* กล่องกลางจอขนาด ~70% ของจอ */}
      <div
        className="
        w-[70vw] h-[70vh] max-w-[1100px] rounded-2xl bg-slate-100
        flex items-center justify-center
        shadow-sm
      "
      >
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-16 w-16 md:h-24 md:w-24 rounded-full
                            border-4 md:border-8 border-slate-300
                            border-t-slate-800 animate-spin"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 animate-[fadeIn_.35s_ease]">
            {/* วงกลมติ๊กถูก */}
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-slate-300/60 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="#111827"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {/* ข้อความ */}
            <div className="text-center mt-1">
              <div className="font-semibold text-slate-800 text-lg">
                Hi {user?.name || "there"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                You Registration successfull
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
