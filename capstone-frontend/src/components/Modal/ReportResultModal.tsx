import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { FaRegSmile, FaRegFrown } from "react-icons/fa"
import type { MyReportAdminAction } from "../../api/reportApi"

interface ReportResultModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: number
  status: "RESOLVED" | "CLOSED"
  adminActions: MyReportAdminAction[]
  loading?: boolean
}

function getActionLabel(action_type: string): string {
  switch (action_type) {
    case "WARN_USER":
      return "Warning"
    case "SUSPEND_USER":
      return "Suspension"
    case "BAN_USER":
      return "Permanent Ban"
    default:
      return action_type
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

  const reviewDate = latestAction
    ? new Date(latestAction.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : ""

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-[560px] transform overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="px-7 pt-6 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {/* Emoji icon */}
              <span className="text-2xl mt-0.5">
                {isRejected
                  ? <FaRegFrown className="w-7 h-7 text-red-500" />
                  : <FaRegSmile className="w-7 h-7 text-green-500" />
                }
              </span>
              <h3 className="text-xl font-bold text-gray-900">
                {isRejected ? "Report Rejected" : "Report Resolved"}{" "}
                <span className="text-[#ff5a36]">[ {reportLabel} ]</span>
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-9">
            {isRejected
              ? "Your report has been reviewed by the administrator but was not approved."
              : "Your report has been reviewed and resolved by the administrator."}
          </p>
        </div>

        <hr className="border-gray-200 mx-7" />

        <div className="px-7 py-5">
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
              {/* Action Token (only for Resolved) */}
              {!isRejected && latestAction.action_type !== "NO_ACTION" && (
                <div className="mb-5">
                  <label className="text-sm font-semibold text-gray-800 mb-2 block">
                    Action Token<span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-gray-700 font-medium">
                    Action Taken : {getActionLabel(latestAction.action_type)}
                  </p>
                  {latestAction.blacklist?.banned_from && latestAction.blacklist?.banned_until && (
                    <p className="text-sm text-gray-500 mt-1">
                      Period : {new Date(latestAction.blacklist.banned_from).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      {" → "}
                      {new Date(latestAction.blacklist.banned_until).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              )}

              {/* Note */}
              {latestAction.note && (
                <div className="mb-5">
                  <label className="text-sm font-semibold text-gray-800 mb-2 block">
                    note<span className="text-red-500">*</span>
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[60px]">
                    {latestAction.note}
                  </div>
                </div>
              )}

              {/* Review Date (only for Resolved) */}
              {!isRejected && reviewDate && (
                <p className="text-sm text-gray-500 mb-1">
                  Review Date : {reviewDate}
                </p>
              )}

              {/* Additional info for Rejected */}
              {isRejected && (
                <p className="text-sm text-gray-500 mt-2">
                  If you have additional evidence, you may submit a new report.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-base font-bold text-white bg-[#ff5a36] hover:bg-[#e04e2d] transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
