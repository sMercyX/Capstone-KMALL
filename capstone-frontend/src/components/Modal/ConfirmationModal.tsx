import { X, AlertTriangle } from "lucide-react"

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  variant = "danger",
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          buttonBg: "bg-red-600 hover:bg-red-700",
          buttonRing: "focus:ring-red-300",
        }
      case "warning":
        return {
          iconBg: "bg-orange-100",
          iconColor: "text-orange-600",
          buttonBg: "bg-orange-600 hover:bg-orange-700",
          buttonRing: "focus:ring-orange-300",
        }
      case "info":
      default:
        return {
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          buttonBg: "bg-blue-600 hover:bg-blue-700",
          buttonRing: "focus:ring-blue-300",
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all animate-in zoom-in-95 duration-200 scale-100">
        
        <div className="flex items-center justify-between mb-5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
                <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors"
            >
                <X className="w-5 h-5 text-gray-500" />
            </button>
        </div>

        <h3 className="text-lg font-bold leading-6 text-gray-900 mb-2">
          {title}
        </h3>
        
        {message && (
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {message}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="inline-flex justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`inline-flex justify-center rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.buttonBg} ${styles.buttonRing}`}
            onClick={() => {
                onConfirm()
                onClose()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
