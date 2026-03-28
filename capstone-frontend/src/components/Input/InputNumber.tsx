import React, { forwardRef } from "react"

interface InputNumberProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: boolean
  required?: boolean
  allowNegative?: boolean
}

export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(
  ({ label, error, required, allowNegative = false, className = "", onChange, onBlur, value, ...props }, ref) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      
      // If negative is not allowed and the value contains a minus sign, ignore
      if (!allowNegative && val.includes("-")) {
        return;
      }

      if (onChange) {
        onChange(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // If empty, reset to "0"
      if (e.target.value === "") {
        const event = {
          ...e,
          target: { ...e.target, value: "0" },
          currentTarget: { ...e.currentTarget, value: "0" }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        
        if (onChange) onChange(event);
      }

      if (onBlur) {
        onBlur(e);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1 text-text font-semibold text-gray-800">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type="number"
          step="any"
          className={`w-full bg-white rounded-lg border px-3 py-2.5 text-text focus:outline-none focus:ring-2 ${
            error
              ? "border-red-500 focus:ring-red-400"
              : "border-gray-300 focus:ring-orange-400"
          } ${className}`}
          onChange={handleChange}
          onBlur={handleBlur}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          value={value}
          {...props}
        />
      </div>
    )
  }
)

InputNumber.displayName = "InputNumber"
