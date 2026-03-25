// src/modules/AddressPage/AddressPage.tsx
import { useEffect, useState } from "react"
import { Plus, Trash2, Star, Info, Box } from "lucide-react"
import { toast } from "react-toastify"
import BackButton from "../../components/Buttons/BackButton"
import ConfirmationModal from "../../components/Modal/ConfirmationModal"
import AddressModal from "./AddressModal"
import { useAddressApi, type UserAddress } from "../../api/addressApi"

export default function AddressPage() {
  const { getAddresses, createAddress, updateAddress, deleteAddress } = useAddressApi()
  
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null)
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState<number | null>(null)

  const fetchAddresses = async () => {
    setIsLoading(true)
    try {
      const res = await getAddresses()
      const data = res.data
      
      if (Array.isArray(data)) {
        setAddresses(data)
      } else if (data && typeof data === "object" && Array.isArray((data as any).items)) {
        setAddresses((data as any).items)
      } else {
        setAddresses([])
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load addresses")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [])

  const handleAddClick = () => {
    setEditingAddress(null)
    setIsAddrModalOpen(true)
  }

  const handleEditClick = (address: UserAddress) => {
    setEditingAddress(address)
    setIsAddrModalOpen(true)
  }

  const handleDeleteClick = (id: number) => {
    setAddressToDelete(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!addressToDelete) return
    try {
      await deleteAddress(addressToDelete)
      toast.success("Address deleted")
      fetchAddresses()
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete address")
    } finally {
      setIsDeleteModalOpen(false)
      setAddressToDelete(null)
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await updateAddress(id, { is_default: true })
      toast.success("Default updated")
      fetchAddresses()
    } catch (err) {
      console.error(err)
      toast.error("Failed to update default")
    }
  }

  const handleSaveAddress = async (formData: Omit<UserAddress, "id" | "user_id" | "is_default" | "is_active" | "created_at" | "updated_at">) => {
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, formData)
        toast.success("Address updated")
      } else {
        await createAddress(formData)
        toast.success("Address added")
      }
      fetchAddresses()
    } catch (err) {
      console.error(err)
      toast.error("Failed to save address")
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-3xl pt-10 pb-20 px-4 md:px-0">
        {/* Header - Slimmer */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-1 text-gray-400 mb-2 hover:text-gray-600 transition-colors cursor-pointer w-fit scale-90 -ml-2">
               <BackButton />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Manage Addresses</h1>
            <p className="text-gray-400 text-sm italic">Campus Delivery Services</p>
          </div>
          <button
            onClick={handleAddClick}
            className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Address</span>
          </button>
        </div>

        {/* List Content - Compact */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-8">
          {isLoading ? (
            <div className="p-10 text-center text-xs text-gray-400">Loading...</div>
          ) : addresses.length === 0 ? (
            <div className="p-10 text-center text-xs text-gray-400">No addresses.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {addresses.map((addr, index) => (
                <div key={addr.id} className="p-5 hover:bg-gray-50 transition-colors group relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address {index + 1}</p>
                      {addr.is_default && (
                        <div className="bg-[#FFF1F0] text-[#FF4D00] text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#FFD8D6]">
                          <Star className="w-3.5 h-3.5 fill-[#FF4D00]" />
                          Default
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteClick(addr.id)}
                      className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-sm text-gray-700 leading-snug space-y-0.5">
                    <p className="font-medium text-gray-900">{addr.address_line1}</p>
                    {addr.address_line2 && <p className="text-gray-500">{addr.address_line2}</p>}
                    <p className="text-gray-500 text-xs">
                      {addr.district}, {addr.province} {addr.postal_code}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-[11px] font-bold text-gray-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                      >
                         <Star className="w-3 h-3" />
                         Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleEditClick(addr)}
                      className="text-[11px] font-bold text-orange-600 hover:underline"
                    >
                      Edit 
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blue Info Box - New Design */}
        <div className="bg-[#F0F7FF] border border-[#BEDAFF] rounded-2xl p-5 flex gap-4">
           <div className="bg-white rounded-full p-2 h-fit border border-[#BEDAFF] shadow-sm">
              <Box className="w-5 h-5 text-[#0066FF]" />
           </div>
           <div className="text-[13px] text-[#0066FF] space-y-2">
              <p className="font-bold text-base leading-none mb-1">About Campus Delivery Service</p>
              <ul className="space-y-1 ml-1">
                <li className="flex items-start gap-2">
                   <span className="mt-1.5 w-1 h-1 rounded-full bg-[#0066FF] shrink-0" />
                   <span>Addresses will be used for delivery within King Mongkut's University of Technology Thonburi</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="mt-1.5 w-1 h-1 rounded-full bg-[#0066FF] shrink-0" />
                   <span>Default address will be automatically selected when placing an order</span>
                </li>
                <li className="flex items-start gap-2">
                   <span className="mt-1.5 w-1 h-1 rounded-full bg-[#0066FF] shrink-0" />
                   <span>You can change the delivery address during checkout</span>
                </li>
              </ul>
           </div>
        </div>

        {/* Modals */}
        <AddressModal
          isOpen={isAddrModalOpen}
          onClose={() => setIsAddrModalOpen(false)}
          onSave={handleSaveAddress}
          initialData={editingAddress}
          title={editingAddress ? "Edit Address" : "Add Address"}
        />

        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="Delete Address"
          message="Confirm deletion?"
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </div>
  )
}
