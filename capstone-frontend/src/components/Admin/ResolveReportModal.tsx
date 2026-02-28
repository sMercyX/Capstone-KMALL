import { createPortal } from "react-dom"
import { useState } from "react"
import { X, AlertTriangle } from "lucide-react"

export type ActionType = "WARN_USER" | "SUSPEND_USER" | "BAN_USER"

export interface ResolveActionData {
  action_type: ActionType
  suspend_days?: number
  is_permanent?: boolean
}

interface ResolveReportModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: ResolveActionData) => void
  targetUserName: string
  targetUserRole: "SELLER" | "BUYER"
}

export default function ResolveReportModal({
  isOpen,
  onClose,
  onConfirm,
  targetUserName,
  targetUserRole
}: ResolveReportModalProps) {
  const [actionType, setActionType] = useState<ActionType>("WARN_USER")
  const [suspendDays, setSuspendDays] = useState<number>(7)

  if (!isOpen) return null

  const handleConfirm = () => {
    const payload: ResolveActionData = { action_type: actionType }
    
    if (actionType === "SUSPEND_USER") {
      payload.suspend_days = suspendDays
    } else if (actionType === "BAN_USER") {
      payload.is_permanent = true
    }
    
    onConfirm(payload)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all animate-in zoom-in-95 duration-200 scale-100">
        
        <div className="flex items-center justify-between mb-5">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors"
            >
                <X className="w-5 h-5 text-gray-500" />
            </button>
        </div>

        <h3 className="text-lg font-bold leading-6 text-gray-900 mb-2">
          Resolve Report
        </h3>
        
        <div className="mt-2 text-sm text-gray-500 mb-6">
          <div>Take action against reported user: <span className="font-semibold text-gray-800">{targetUserName}</span></div>
          <div className="text-xs text-orange-500 mt-1 uppercase font-semibold">{targetUserRole}</div>
        </div>

        <div className="space-y-4">
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${actionType === 'WARN_USER' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input 
              type="radio" 
              name="action_type" 
              value="WARN_USER" 
              checked={actionType === 'WARN_USER'}
              onChange={() => setActionType('WARN_USER')}
              className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
            />
            <div>
              <div className="font-medium text-gray-900">Warn User</div>
              <div className="text-xs text-gray-500">Send a warning notification to the user without restricting their account.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${actionType === 'SUSPEND_USER' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input 
              type="radio" 
              name="action_type" 
              value="SUSPEND_USER" 
              checked={actionType === 'SUSPEND_USER'}
              onChange={() => setActionType('SUSPEND_USER')}
              className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
            />
            <div className="w-full">
              <div className="font-medium text-gray-900">Suspend User</div>
              <div className="text-xs text-gray-500 mb-2">Temporarily disable the user's account for a specific duration.</div>
              
              {actionType === 'SUSPEND_USER' && (
                <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${actionType === 'BAN_USER' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input 
              type="radio" 
              name="action_type" 
              value="BAN_USER" 
              checked={actionType === 'BAN_USER'}
              onChange={() => setActionType('BAN_USER')}
              className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
            />
            <div>
              <div className="font-medium text-red-700">Ban User</div>
              <div className="text-xs text-red-500">Permanently disable the user's account. This action is severe.</div>
            </div>
          </label>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            className="inline-flex justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex justify-center rounded-xl border border-transparent bg-[#ff5a36] hover:bg-[#e04a29] px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            onClick={handleConfirm}
          >
            Confirm Action
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
