import { createPortal } from "react-dom"
import { X, Ban, ShieldAlert, AlertTriangle, ShieldX } from "lucide-react"

export interface AdminAction {
  action_id: number
  report_id: number
  admin_id: string
  action_type: string
  note?: string | null
  target_user_id?: string | null
  target_store_id?: number | null
  suspend_days?: number | null
  is_permanent?: boolean
  created_at: string
}

interface ReportResultModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: number
  status: "RESOLVED" | "CLOSED"
  adminActions: AdminAction[]
  loading?: boolean
}

function getActionLabel(action_type: string) {
  switch (action_type) {
    case "NO_ACTION":
      return "Report Rejected"
    case "WARN_USER":
      return "Warning Issued"
    case "SUSPEND_USER":
      return "Account Suspended"
    case "BAN_USER":
      return "Account Banned"
    default:
      return action_type
  }
}

function getActionIcon(action_type: string) {
  switch (action_type) {
    case "NO_ACTION":
      return <ShieldX className="w-6 h-6" />
    case "WARN_USER":
      return <AlertTriangle className="w-6 h-6" />
    case "SUSPEND_USER":
      return <ShieldAlert className="w-6 h-6" />
    case "BAN_USER":
      return <Ban className="w-6 h-6" />
    default:
      return <ShieldAlert className="w-6 h-6" />
  }
}

function getActionColor(status: "RESOLVED" | "CLOSED", action_type: string) {
  if (status === "CLOSED" || action_type === "NO_ACTION") {
    return { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: "text-red-500" }
  }
  switch (action_type) {
    case "WARN_USER":
      return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "text-amber-500" }
    case "SUSPEND_USER":
      return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: "text-orange-500" }
    case "BAN_USER":
      return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "text-red-500" }
    default:
      return { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "text-green-500" }
  }
}

export default function ReportResultModal({
  isOpen,
  onClose,
  reportId,
  status,
  adminActions,
  loading,
}: ReportResultModalProps) {
  if (!isOpen) return null

  const reportLabel = `#RPT-${reportId.toString().padStart(4, "0")}`
  const isRejected = status === "CLOSED"
  const latestAction = adminActions.length > 0 ? adminActions[adminActions.length - 1] : null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-[520px] transform overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold text-gray-900">
            Report Result{" "}
            <span className="text-[#ff5a36]">[ {reportLabel} ]</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <hr className="border-gray-200" />

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#ff5a36] rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading report details...</p>
            </div>
          ) : !latestAction ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No action details available yet.
            </div>
          ) : (
            <>
              {/* Status Banner */}
              {(() => {
                const colors = getActionColor(status, latestAction.action_type)
                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${colors.bg} ${colors.border} border mb-5`}>
                    <div className={colors.icon}>
                      {getActionIcon(latestAction.action_type)}
                    </div>
                    <div>
                      <p className={`font-semibold ${colors.text}`}>
                        {isRejected ? "Report Rejected" : getActionLabel(latestAction.action_type)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(latestAction.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Suspension Details */}
              {latestAction.action_type === "SUSPEND_USER" && latestAction.suspend_days && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Suspension Period:</span>{" "}
                    {latestAction.is_permanent ? "Permanent" : `${latestAction.suspend_days} days`}
                  </p>
                </div>
              )}

              {/* Admin Note */}
              {latestAction.note && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Admin Note
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {latestAction.note}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
