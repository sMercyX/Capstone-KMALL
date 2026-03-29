import { X } from "lucide-react"

type Props = {
  open: boolean
  onClose: () => void
}

export default function AgreementModal({ open, onClose }: Props) {


  if (!open) return null


  const terms = [
    "Users must be students and staff of King Mongkut's University of Technology Thonburi (KMUTT), have a university email address (@kmutt.ac.th), and have completed Microsoft Teams SSO verification.",
    "Used for buying and selling goods within the university and for arranging pick-ups within the university grounds only.",
    "It must not be used for illegal purposes, in violation of university regulations, or to cause distress to others.",
    "Post your product listing with accurate information (photos, price, details, condition).",
    "Prohibited items for sale are prohibited, including illegal substances, weapons, cigarettes, alcohol, narcotics, and perishable goods that pose a safety risk.",
    "Clearly specify the pickup location and time. Confirm/reject the order quickly.",
    "Please check the details before ordering and arrive at the scheduled time for pickup.",
    "Use the internal chat system for transactions only.",
    "Do not post inappropriate content, spam, dangerous links, or deceptive messages.",
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-8 md:p-10 ">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
                KMALL – KMUTT Marketplace
              </h2>
              <p className="text-description font-bold text-gray-400">
                KMALL Access Requirements
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer group"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
            </button>
          </div>

          {/* Policy List Section */}
          <div 
            className="space-y-4 max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#e5e7eb transparent'
            }}
          >
            {terms.map((term, index) => (
              <div key={index} className="flex gap-4">
                <span className="text-gray-900 font-bold min-w-[20px]">{index + 1}.</span>
                <p className="text-text text-gray-700 font-medium leading-relaxed">
                  {term}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
