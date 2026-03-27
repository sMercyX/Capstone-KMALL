// src/modules/AddressPage/AddressModal.tsx
import React, { useEffect, useState } from "react"
import { X, MapPin, Box } from "lucide-react"
import * as yup from "yup"
import { toast } from "react-toastify"
import { Input } from "../../components/Input/Input"
import type { UserAddress } from "../../api/addressApi"

interface AddressModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Omit<UserAddress, "id" | "user_id" | "is_active" | "created_at" | "updated_at">) => Promise<void>
  initialData?: UserAddress | null
  title?: string
}

const addressSchema = yup.object().shape({
  label: yup.string().required("Please enter name"),
  phone: yup.string().required("Please enter phone number").matches(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
  address_line1: yup.string().required("Please enter address"),
  district: yup.string().required("Please enter district"),
  postal_code: yup.string().optional(),
  province: yup.string().optional(),
})

export default function AddressModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = "Add New Delivery Address"
}: AddressModalProps) {
  const [formData, setFormData] = useState<Omit<UserAddress, "id" | "user_id" | "is_active" | "created_at" | "updated_at">>({
    label: "",
    phone: "",
    address_line1: "",
    district: "",
    province: "Bangkok",
    postal_code: "10140",
    is_default: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        label: initialData.label,
        phone: initialData.phone,
        address_line1: initialData.address_line1,
        district: initialData.district,
        province: initialData.province,
        postal_code: initialData.postal_code,
        is_default: initialData.is_default,
      })
    } else {
      setFormData({
        label: "",
        phone: "",
        address_line1: "",
        district: "",
        province: "Bangkok",
        postal_code: "10140",
        is_default: false,
      })
    }
    setErrors({})
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === "phone") {
        const numericValue = value.replace(/[^0-9]/g, "").slice(0, 10)
        setFormData(prev => ({ ...prev, [name]: numericValue }))
    } else {
        setFormData(prev => ({ ...prev, [name]: value }))
    }
    
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
        toast.error("Please fill in all required fields")
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
          <div className="bg-[#EBF5FF] border border-[#BADAFF] rounded-2xl p-4 flex gap-3 transition-all hover:shadow-sm items-start">
            <Box className="w-5 h-5 text-[#0066FF] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-[#0066FF] leading-none mb-0.5">Campus Delivery Service</h3>
              <p className="text-[11px] text-[#0066FF] leading-relaxed font-medium">
                Please add your address to receive products from sellers within the university. 
                This address will be used for delivery within KMUTT. 
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Input
                label="Name"
                name="label"
                required
                value={formData.label}
                onChange={handleChange}
                placeholder="Name"
                error={!!errors.label}
                className="text-xs py-2"
              />
              {errors.label && (
                <p className="text-[10px] text-red-500 font-medium ml-1">{errors.label}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Phone Number"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="0910402800"
                maxLength={10}
                error={!!errors.phone}
                className="text-xs py-2"
              />
              {errors.phone && (
                <p className="text-[10px] text-red-500 font-medium ml-1">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                label="Address"
                name="address_line1"
                required
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  label="District"
                  name="district"
                  required
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
                  label="Postal Code (Fixed)"
                  name="postal_code"
                  value={formData.postal_code}
                  readOnly
                  className="text-xs py-2 bg-gray-50 text-gray-900 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Input
                label="Province (Fixed)"
                name="province"
                value={formData.province}
                readOnly
                className="text-xs py-2 bg-gray-50 text-gray-900 cursor-default"
              />
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
