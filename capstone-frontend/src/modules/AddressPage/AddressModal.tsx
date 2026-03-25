// src/modules/AddressPage/AddressModal.tsx
import React, { useEffect, useState } from "react"
import { X, ChevronLeft, MapPin, AlertCircle } from "lucide-react"
import * as yup from "yup"
import { Input } from "../../components/Input/Input"
import type { UserAddress } from "../../api/addressApi"

interface AddressModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Omit<UserAddress, "id" | "user_id" | "is_default" | "is_active" | "created_at" | "updated_at">) => Promise<void>
  initialData?: UserAddress | null
  title?: string
}

const addressSchema = yup.object().shape({
  address_line1: yup.string().required("Please enter address"),
  address_line2: yup.string().optional(),
  district: yup.string().required("Please enter district"),
  postal_code: yup.string().required("Please enter postal code").matches(/^[0-9]{5}$/, "Please enter a valid postal code"),
  province: yup.string().required("Please select province"),
})

export default function AddressModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = "Add New Delivery Address"
}: AddressModalProps) {
  const [formData, setFormData] = useState<Omit<UserAddress, "id" | "user_id" | "is_default" | "is_active" | "created_at" | "updated_at">>({
    address_line1: "",
    address_line2: "",
    district: "",
    province: "",
    postal_code: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        address_line1: initialData.address_line1,
        address_line2: initialData.address_line2 || "",
        district: initialData.district,
        province: initialData.province,
        postal_code: initialData.postal_code,
      })
    } else {
      setFormData({
        address_line1: "",
        address_line2: "",
        district: "",
        province: "",
        postal_code: "",
      })
    }
    setErrors({})
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await addressSchema.validate(formData, { abortEarly: false })
      await onSave(formData)
      onClose()
    } catch (err: any) {
      if (err.inner) {
        const validationErrors: Record<string, string> = {}
        err.inner.forEach((error: any) => {
          if (error.path) validationErrors[error.path] = error.message
        })
        setErrors(validationErrors)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl relative flex flex-col max-h-[90vh]">
        {/* Header - Smoothed and smaller */}
        <div className="flex items-center p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-600" />
             </div>
             <div>
                <h2 className="text-lg font-bold text-gray-900 leading-none">{title}</h2>
             </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="ml-auto p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content - Compact */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex gap-3">
             <div className="shrink-0">
                <AlertCircle className="w-4 h-4 text-blue-500" />
             </div>
             <p className="text-xs text-blue-600 leading-tight">
                Please add your address for delivery within KMUTT. 
                <span className="block mt-1 font-semibold opacity-70 italic font-normal">💡 Profiles → Addresses</span>
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Input
                label="Address *"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="House number, Street, Dormitory"
                error={!!errors.address_line1}
                className="text-xs py-2"
              />
              {errors.address_line1 && (
                <p className="text-[10px] text-red-500 font-medium ml-1">{errors.address_line1}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Additional Address (Optional)"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="District, Facilty, Building"
                className="text-xs py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  label="District *"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  placeholder="District, Facilty, Building"
                  error={!!errors.district}
                  className="text-xs py-2"
                />
                {errors.district && (
                  <p className="text-[10px] text-red-500 font-medium ml-1">{errors.district}</p>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  label="Postal Code *"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="10110"
                  error={!!errors.postal_code}
                  className="text-xs py-2"
                />
                {errors.postal_code && (
                  <p className="text-[10px] text-red-500 font-medium ml-1">{errors.postal_code}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block mb-1 text-[11px] font-semibold text-gray-800">
                Province *
              </label>
              <select
                name="province"
                value={formData.province}
                onChange={handleChange}
                className={`w-full bg-white rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 appearance-none 
                  ${errors.province 
                    ? "border-red-500 focus:ring-red-400 text-red-500" 
                    : "border-gray-300 focus:ring-orange-400 text-gray-900"
                }`}
              >
                <option value="" disabled>Select Province</option>
                <option value="Bangkok">Bangkok</option>
                <option value="Nonthaburi">Nonthaburi</option>
                <option value="Samut Prakan">Samut Prakan</option>
                <option value="Pathum Thani">Pathum Thani</option>
              </select>
              {errors.province && (
                <p className="text-[10px] text-red-500 font-medium ml-1 mt-0.5">{errors.province}</p>
              )}
            </div>
          </form>
        </div>

        {/* Footer - Smaller buttons */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-white bg-gray-400 rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Address"}
          </button>
        </div>
      </div>
    </div>
  )
}
