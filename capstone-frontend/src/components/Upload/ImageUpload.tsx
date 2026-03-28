import React, { useRef, useState } from "react"

interface ImageUploadProps {
  onFilesChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
  error?: boolean
  className?: string
  label?: string
  required?: boolean
  hint?: string
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onFilesChange,
  multiple = true,
  accept = "image/*",
  error = false,
  className = "",
  label,
  required,
  hint,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileNames, setSelectedFileNames] = useState<string>("")

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileList = Array.from(files)
      onFilesChange(fileList)
      
      if (fileList.length === 1) {
        setSelectedFileNames(fileList[0].name)
      } else {
        setSelectedFileNames(`${fileList.length} files selected`)
      }
    } else {
      setSelectedFileNames("")
    }
    // Reset the input value so the same file can be selected again
    e.target.value = ""
  }

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block mb-1 text-text font-semibold text-gray-800">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      
      <div
        onClick={handleClick}
        className={`
          flex items-center w-full bg-white rounded-lg border px-1 py-1.5 cursor-pointer transition-all duration-200
          ${error 
            ? "border-red-500 ring-1 ring-red-400" 
            : "border-gray-200 hover:border-orange-300 shadow-sm"
          }
        `}
      >
        <div className="px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm font-semibold text-gray-700 gray hover:bg-gray-100 transition-colors mr-3 ml-1 shadow-sm">
          Choose File
        </div>
        
        <span className={`text-sm flex-1 truncate ${selectedFileNames ? "text-gray-900" : "text-gray-400"}`}>
          {selectedFileNames || "No file selected"}
        </span>

        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
