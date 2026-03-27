import { createPortal } from "react-dom"
import { useState } from "react"
import { X, AlertTriangle, Lock, Ban, ShieldAlert, Check, Circle } from "lucide-react"
import { PiCircleFill } from "react-icons/pi"

export type ActionType = "WARN_USER" | "SUSPEND_USER" | "BAN_USER"

export interface ResolveActionData {
  action_type: ActionType
  suspend_days?: number
  is_permanent?: boolean
  note?: string
}

interface ResolveReportModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: ResolveActionData) => void
  targetUserName: string
  targetUserRole: "SELLER" | "BUYER"
  reportId?: number
}

export default function ResolveReportModal({
  isOpen,
  onClose,
  onConfirm,
  reportId
}: ResolveReportModalProps) {
  const [actionType, setActionType] = useState<ActionType>("WARN_USER")
  const [suspendDays, setSuspendDays] = useState<number>(7)
  const [note, setNote] = useState("")

  if (!isOpen) return null

  const handleConfirm = () => {
    const payload: ResolveActionData = { action_type: actionType }
    
    if (actionType === "SUSPEND_USER") {
      payload.suspend_days = suspendDays
    } else if (actionType === "BAN_USER") {
      payload.is_permanent = true
    }

    if (note.trim()) {
      payload.note = note.trim()
    }
    
    onConfirm(payload)
    onClose()
  }

  const reportLabel = reportId ? ` [ #RPT-${reportId.toString().padStart(4, '0')} ]` : ""

  const actions = [
    {
      type: "WARN_USER" as ActionType,
      icon: <AlertTriangle className="w-6 h-6 text-[#ff5a36]" />,
      title: "Warn User",
      description: "Send an official warning message to the user.",
      description2: "Use this when the violation is minor or first-time. No access restrictions will be applied.",
      selectedBorder: "border-[#ff5a36]",
      selectedBg: "bg-[#fff5f3]",
      selectedText: "text-[#ff5a36]",
    },
    {
      type: "SUSPEND_USER" as ActionType,
      icon: <Lock className="w-6 h-6 text-gray-400" />,
      title: "Suspend Account",
      description: "Temporarily restrict the user from using the system.",
      description2: "The user will not be able to place orders or interact until the suspension expires.",
      selectedBorder: "border-[#ff5a36]",
      selectedBg: "bg-[#fff5f3]",
      selectedText: "text-[#ff5a36]",
    },
    {
      type: "BAN_USER" as ActionType,
      icon: <Ban className="w-6 h-6 text-gray-400" />,
      title: "Ban User",
      description: "Permanently block the user from accessing the system.",
      description2: "This action should only be used for serious violations such as fraud or repeated offenses.",
      selectedBorder: "border-[#ff5a36]",
      selectedBg: "bg-[#fff5f3]",
      selectedText: "text-[#ff5a36]",
    },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[600px] transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all animate-in zoom-in-95 duration-200 scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-[#ff5a36]" />
            <h3 className="text-xl font-bold text-gray-900">
              Backlist<span className="text-[#ff5a36]">{reportLabel}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Action Cards */}
        <div className="space-y-3 mt-6">
          {actions.map((action) => {
            const isSelected = actionType === action.type
            return (
              <div
                key={action.type}
                onClick={() => setActionType(action.type)}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected 
                    ? `${action.selectedBorder} ${action.selectedBg}` 
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isSelected ? <AlertTriangle className="w-6 h-6 text-[#ff5a36]" /> : action.icon}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${isSelected ? action.selectedText : "text-gray-900"}`}>
                    {action.title}
                  </div>
                  <div className={`text-sm mt-0.5 ${isSelected ? action.selectedText : "text-gray-500"}`}>
                    {action.description}
                  </div>
                  <div className={`text-sm ${isSelected ? action.selectedText : "text-gray-500"}`}>
                    {action.description2}
                  </div>

                  {/* Suspend days input */}
                  {action.type === "SUSPEND_USER" && isSelected && (
                    <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input 
                        type="number" 
                        min={1} 
                        max={365}
                        value={suspendDays}
                        onChange={(e) => setSuspendDays(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      />
                      <span className="text-sm text-gray-600">days</span>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center bg-white justify-center ${
                    isSelected ? "border-[#ff5a36] bg-[#ff5a36]" : "border-gray-300"
                  }`}>
                    {isSelected && (
                      <PiCircleFill className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reason / Note */}
        <div className="mt-5">
          <label className="text-sm font-semibold text-gray-800">
            note<span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Provide a reason for this action..."
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:border-[#ff5a36] focus:outline-none focus:ring-1 focus:ring-[#ff5a36] resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-6 py-2.5 rounded-lg bg-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!note.trim()}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors ${
              note.trim() 
                ? "bg-[#ff5a36] hover:bg-[#e04a29]" 
                : "bg-gray-300 cursor-not-allowed"
            }`}
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
