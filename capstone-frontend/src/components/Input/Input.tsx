import React, { forwardRef } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: boolean
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block mb-1 text-[11px] font-semibold text-gray-800">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-white rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-300  focus:ring-orange-400"
          } ${className}`}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = "Input"
