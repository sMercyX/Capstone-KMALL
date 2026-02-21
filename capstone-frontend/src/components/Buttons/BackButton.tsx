import { useNavigate } from "react-router-dom"
import { IoChevronBack } from "react-icons/io5"

interface BackButtonProps {
  to?: string
  className?: string
  label?: string
}

export default function BackButton({ to, className = "", label = "Back" }: BackButtonProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`flex items-center gap-1 text-gray-600 hover:text-gray-900 cursor-pointer transition-colors ${className}`}
    >
      <IoChevronBack className="h-6 w-6" />
      <span className="font-medium text-base">{label}</span>
    </button>
  )
}
