import React, { forwardRef } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: boolean
  required?: boolean
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, className = "", containerClassName = "", ...props }, ref) => {
    return (
      <div className={containerClassName}>
        {label && (
          <label className="block mb-1 text-text font-semibold text-gray-800">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-white rounded-lg border px-3 py-2.5 text-text focus:outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-300  focus:ring-orange-400"
          } ${className}`}
          {...props}
        />
        {props.maxLength && (
          <p className="text-description text-gray-500 text-right mt-1">
            {String(props.value || "").length} / {props.maxLength} characters
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"
