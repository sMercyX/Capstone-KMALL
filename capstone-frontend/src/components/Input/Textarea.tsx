import React, { forwardRef } from "react"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block mb-1 text-sm font-semibold text-gray-800">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full bg-white rounded-lg border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-300 focus:ring-orange-400"
          } ${className}`}
          {...props}
        />
      </div>
    )
  }
)

Textarea.displayName = "Textarea"
