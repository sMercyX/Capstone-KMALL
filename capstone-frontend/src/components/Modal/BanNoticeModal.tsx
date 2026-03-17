import { AlertTriangle, LogOut, Ban, X, ShoppingCart, User } from "lucide-react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import type { UserBan } from "../../api/userApi"
import kmallText from "../../assets/kmutt-text.svg"

interface BanNoticeModalProps {
  ban: UserBan
  onClose: () => void
}

export default function BanNoticeModal({ ban, onClose }: BanNoticeModalProps) {
  const isSeller = ban.user_role === "SELLER"
  
  const getBanConfig = () => {
    switch (ban.ban_type) {
      case "WARNING":
        return {
          title: "Warning Notice",
          icon: <AlertTriangle className="w-16 h-16 text-yellow-500" />,
          description: `Your ${isSeller ? 'store' : 'account'} has received a warning due to a violation reported by a ${isSeller ? 'buyer' : 'seller'}.`,
          subDescription: isSeller ? "As a result, your store has been temporarily hidden from the marketplace." : "Please review the platform policies to ensure your account remains in good standing.",
          footerDescription: "Please review the report details and ensure your store follows the platform policies.",
          actionLabel: isSeller ? "Hide Store" : "Warning",
          actionColor: "bg-[#FFB300]",
          boxBg: "bg-[#FFF9E6]",
          boxBorder: "border-[#FFEB99]",
          periodLabel: "Warning Period",
        }
      case "TEMPORARY":
        return {
          title: "Temporary Restriction",
          icon: <LogOut className="w-16 h-16 text-[#ff5a36]" />,
          description: `Your ${isSeller ? 'store' : 'account'} has been temporarily suspended due to a violation reported by a ${isSeller ? 'buyer' : 'seller'}.`,
          subDescription: isSeller ? "During this period, your store will not be able to receive new orders." : "During this period, you will not be able to perform certain actions on the platform.",
          footerDescription: "",
          actionLabel: isSeller ? "Suspend Store" : "Suspend Account",
          actionColor: "bg-[#FF5722]",
          boxBg: "bg-[#FFF2F2]",
          boxBorder: "border-[#FFCDD2]",
          periodLabel: "Suspension Period",
        }
      case "PERMANENT":
        return {
          title: "Permanent Restriction",
          icon: <Ban className="w-16 h-16 text-red-600" />,
          description: `Your ${isSeller ? 'store' : 'account'} has been permanently removed from the marketplace due to serious violations of platform policies.`,
          subDescription: isSeller ? "Your store is no longer available to customers." : "Your account has been deactivated permanently.",
          footerDescription: "",
          actionLabel: isSeller ? "Delete Store" : "Permanent Ban",
          actionColor: "bg-[#F44336]",
          boxBg: "bg-[#FFF2F2]",
          boxBorder: "border-[#FFCDD2]",
          periodLabel: ban.ban_type === "PERMANENT" ? "Decision Date" : "Restriction Period",
        }
    }
  }

  const config = getBanConfig()

  const formatDateLabel = (ban: UserBan) => {
    if (ban.ban_type === "PERMANENT") {
      return format(new Date(ban.banned_from), "MMM d, yyyy")
    }
    if (ban.banned_until) {
      return `${format(new Date(ban.banned_from), "MMM d")} – ${format(new Date(ban.banned_until), "MMM d, yyyy")}`
    }
    return format(new Date(ban.banned_from), "MMM d, yyyy")
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-[650px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#E53935] px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={kmallText} alt="KMALL" className="h-7 w-auto brightness-0 invert" />
            <div className="w-px h-6 bg-white/40" />
            <h2 className="text-lg font-semibold text-white">Account Enforcement Notice</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white hover:bg-white/10 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center">
          <div className="mb-4">
            {config.icon}
          </div>
          
          <h3 className="text-2xl font-bold text-gray-800 mb-4">{config.title}</h3>
          
          <div className="space-y-3 mb-8 max-w-[500px]">
            <p className="text-gray-600 text-sm">{config.description}</p>
            <p className="text-gray-600 text-sm">{config.subDescription}</p>
            {config.footerDescription && (
              <p className="text-gray-600 text-sm">{config.footerDescription}</p>
            )}
          </div>

          {/* Affected Role Box */}
          <div className={`w-full ${config.boxBg} border ${config.boxBorder} rounded-xl p-6 text-left relative`}>
            {/* Action Badge */}
            <div className={`absolute top-4 right-4 px-4 py-1.5 rounded-full text-white text-sm font-bold shadow-sm ${config.actionColor}`}>
              {config.actionLabel}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                {isSeller ? <ShoppingCart className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
              </div>
              <div className="text-[20px] font-bold">
                <span className="text-gray-900">Affected Role : </span>
                <span className="text-[#ff5a36]">{isSeller ? 'Seller (Store)' : 'Buyer'}</span>
              </div>
            </div>

            <div className="space-y-1 text-gray-800">
              <p className="text-[17px] font-medium">Reason : {ban.reason}</p>
              <p className="text-[17px] font-medium">
                {config.periodLabel} : {formatDateLabel(ban)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-[#FF4E20] hover:bg-[#E0451B] text-white font-bold py-3 px-10 rounded-xl transition-colors shadow-md"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
