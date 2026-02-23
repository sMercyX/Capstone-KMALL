import { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, Upload, CheckCircle } from "lucide-react"
import { processImageFile } from "../../utils/imageProcessing"

const REPORT_REASONS: { label: string; code: string }[] = [
  {
    label: "The product does not match the description/the description is incorrect.",
    code: "PRODUCT_MISMATCH",
  },
  {
    label: "Ordered but not paid / Paid incorrectly according to the agreement.",
    code: "PAYMENT_ISSUE",
  },
  {
    label: "Inappropriate behavior (rude, threatening)",
    code: "INAPPROPRIATE_BEHAVIOR",
  },
  {
    label: "Attempting to cheat / deceive.",
    code: "FRAUD",
  },
  {
    label: "Selling prohibited/illegal goods.",
    code: "ILLEGAL_GOODS",
  },
  {
    label: "Other",
    code: "OTHER",
  },
]

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "application/zip",
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    reasonCode: string
    details: string
    files: File[]
  }) => Promise<void>
}

export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedReason, setSelectedReason] = useState<typeof REPORT_REASONS[number] | null>(null)
  const [details, setDetails] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep(1)
    setSelectedReason(null)
    setDetails("")
    setFiles([])
    setDragOver(false)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleNext = () => {
    if (!selectedReason) return
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSubmit = async () => {
    if (!selectedReason || details.length < 10) return
    setSubmitting(true)
    try {
      await onSubmit({
        reasonCode: selectedReason.code,
        details,
        files,
      })
      setStep(3) // Show success
    } catch {
      // error handled by caller (toast etc.)
    } finally {
      setSubmitting(false)
    }
  }

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const raw = Array.from(incoming).filter((f) => {
        // Allow HEIC/HEIF by extension even if browser doesn't report the MIME
        const isHeic =
          f.name.toLowerCase().endsWith(".heic") ||
          f.name.toLowerCase().endsWith(".heif")
        if (!isHeic && !ACCEPTED_TYPES.includes(f.type)) return false
        if (f.size > MAX_FILE_SIZE) return false
        return true
      })

      // Convert HEIC/HEIF → JPEG using processImageFile
      const processed = await Promise.all(
        raw.map((f) => processImageFile(f))
      )

      setFiles((prev) => [...prev, ...processed])
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* ===== STEP 1: Choose reason ===== */}
        {step === 1 && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Choose a reason for reporting.
              </h3>
              <button
                onClick={handleClose}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <hr className="border-gray-200" />

            {/* Reason list */}
            <div className="px-6 py-4 space-y-3 max-h-[400px] overflow-y-auto">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.code}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                    selectedReason?.code === reason.code
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleNext}
                disabled={!selectedReason}
                className={`px-8 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${
                  selectedReason
                    ? "bg-orange-500 hover:bg-orange-600 cursor-pointer"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                OK
              </button>
            </div>
          </>
        )}

        {/* ===== STEP 2: Details + Upload ===== */}
        {step === 2 && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="rounded-full p-1 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
                <h3 className="text-base font-bold text-gray-900 leading-snug">
                  {selectedReason?.label}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <hr className="border-gray-200" />

            <div className="px-6 py-5 space-y-6 max-h-[500px] overflow-y-auto">
              {/* Reporting details */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Reporting details<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={200}
                  rows={4}
                  placeholder="Write an explanatory note for the report (10-200) characters."
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {details.length}/200
                </p>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Media Upload<span className="text-red-500">*</span>
                </label>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
                      dragOver
                        ? "border-blue-500 bg-blue-50"
                        : "border-blue-300 hover:border-blue-400"
                    }`}
                  >
                    <Upload className="h-8 w-8 text-blue-500" />
                    <p className="text-sm text-gray-600">
                      Drag your file(s) or{" "}
                      <span className="font-semibold text-blue-600 underline">
                        browse
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Max 10 MB files are allowed
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.svg,.zip,.heic,.heif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Only support .jpg, .png, .svg, .heic, .heif and zip files
                  </p>

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm"
                        >
                          <span className="truncate text-gray-700">
                            {f.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(i)
                            }}
                            className="text-gray-400 hover:text-red-500 ml-2 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={details.length < 10 || submitting}
                className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
                  details.length >= 10 && !submitting
                    ? "bg-orange-500 hover:bg-orange-600 cursor-pointer"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {submitting ? "Submitting..." : "Report"}
              </button>
            </div>
          </>
        )}

        {/* ===== STEP 3: Success ===== */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center px-8 py-16">
            <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-emerald-500 mb-4">
              SUCCESS
            </h3>
            <p className="text-gray-600 text-center leading-relaxed">
              The report has been submitted successfully.
              <br />
              The system administrator will review it soon.
            </p>
            <button
              onClick={handleClose}
              className="mt-8 px-16 py-3 rounded-xl text-base font-semibold text-white bg-emerald-400 hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
