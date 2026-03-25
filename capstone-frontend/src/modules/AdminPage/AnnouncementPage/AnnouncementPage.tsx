import { useState, useEffect } from "react"
import { FaPaperPlane } from "react-icons/fa"
import { Calendar, Trash2 } from "lucide-react"
import { toast } from "react-toastify"
import { useAdminAnnouncementApi, type AnnouncementItem } from "../../../api/adminAnnouncementApi"
import ConfirmationModal from "../../../components/Modal/ConfirmationModal"

type TargetRole = "buyer" | "seller" | "admin"

export default function AnnouncementPage() {
  const { createAnnouncement, getAnnouncements, deleteAnnouncement } = useAdminAnnouncementApi()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<TargetRole[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [isListLoading, setIsListLoading] = useState(false)
  const [page] = useState(1)
  const [deleteModalState, setDeleteModalState] = useState<{isOpen: boolean, id: number | null}>({isOpen: false, id: null})

  const isAllUsersSelected = selectedRoles.length === 3

  const handleToggleRole = (role: TargetRole) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role))
    } else {
      setSelectedRoles([...selectedRoles, role])
    }
  }

  const handleToggleAllUsers = () => {
    if (isAllUsersSelected) {
      setSelectedRoles([]) // Deselect all
    } else {
      setSelectedRoles(["buyer", "seller", "admin"]) // Select all
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error("Please enter an announcement title")
      return
    }
    if (!content.trim()) {
      toast.error("Please enter announcement content")
      return
    }
    if (selectedRoles.length === 0) {
      toast.error("Please select at least one target audience")
      return
    }

    try {
      setIsLoading(true)
      await createAnnouncement({
        title: title.trim(),
        body: content.trim(),
        target_roles: selectedRoles,
      })

      toast.success("Announcement published successfully")
      // Reset form
      setTitle("")
      setContent("")
      setSelectedRoles([])
      
      // Refresh list
      fetchAnnouncements()
    } catch (error: any) {
      console.error("Failed to publish announcement:", error)
      toast.error(error.message || "Failed to publish announcement")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      setIsListLoading(true)
      const res = await getAnnouncements(page, 10, "")
      setAnnouncements(res.announcements || [])
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
    } finally {
      setIsListLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const promptDelete = (id: number) => {
    setDeleteModalState({isOpen: true, id})
  }

  const handleDelete = async () => {
    if (!deleteModalState.id) return
    try {
      await deleteAnnouncement(deleteModalState.id)
      toast.success("Announcement deleted successfully")
      setDeleteModalState({isOpen: false, id: null})
      fetchAnnouncements()
    } catch (error: any) {
      console.error("Failed to delete announcement:", error)
      toast.error(error.message || "Failed to delete announcement")
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      return `Today ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    }
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    })
  }

  const renderTargetRoles = (roles: string[]) => {
    if (!roles || roles.length === 0) return null
    const normalizedRoles = roles.map(r => r.toUpperCase())
    if (normalizedRoles.includes("BUYER") && normalizedRoles.includes("SELLER") && normalizedRoles.includes("ADMIN")) {
      return <span className="text-[10px] bg-[#FF4C24] text-white px-2.5 py-0.5 rounded-full font-medium">All Users</span>
    }
    return normalizedRoles.map(role => (
      <span key={role} className="text-[10px] bg-[#FF4C24] text-white px-2.5 py-0.5 rounded-full font-medium mr-1 uppercase">
        {role === 'SELLER' ? 'Store' : role}
      </span>
    ))
  }

  return (
    <div className="text-[#2D2D2D] mx-auto min-h-full">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 text-sm mb-1">
              Announcements &gt;
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-4">
              Announcements
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Create and manage platform announcements
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <FaPaperPlane className="text-[#FF4C24] w-5 h-5" />
          <h2 className="text-lg font-bold">Create New Announcement</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Fill in the details to create a new announcement
        </p>

        <div className="space-y-6">
          {/* Title input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter announcement title..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF4C24]/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Enter announcement content..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF4C24]/50 min-h-[120px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Target audience selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Target audience <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToggleAllUsers}
                className={`px-6 py-2 rounded-[8px] border text-sm font-medium transition-colors ${
                  isAllUsersSelected
                    ? "bg-[#FF4C24] text-white border-[#FF4C24]"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => handleToggleRole("admin")}
                className={`px-6 py-2 rounded-[8px] border text-sm font-medium transition-colors ${
                  selectedRoles.includes("admin")
                    ? "bg-[#FF4C24] text-white border-[#FF4C24]"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => handleToggleRole("seller")}
                className={`px-6 py-2 rounded-[8px] border text-sm font-medium transition-colors ${
                  selectedRoles.includes("seller")
                    ? "bg-[#FF4C24] text-white border-[#FF4C24]"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Store
              </button>
              <button
                onClick={() => handleToggleRole("buyer")}
                className={`px-6 py-2 rounded-[8px] border text-sm font-medium transition-colors ${
                  selectedRoles.includes("buyer")
                    ? "bg-[#FF4C24] text-white border-[#FF4C24]"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Buyer
              </button>
            </div>
          </div>

          {/* Publish Button */}
          <div className="pt-4 flex justify-end">
            <button
              onClick={handlePublish}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-[#FF4C24] hover:bg-[#E63E1A] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Publishing..." : "Publish Announcement"}
            </button>
          </div>
        </div>
      </div>

      {/* All Announcements List */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab section */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4">
          <button className="text-[13px] font-medium text-[#FF4C24] border-b-[3px] border-[#FF4C24] pb-3 px-6 -mb-0.5 relative top-[1.5px]">
            All
          </button>
        </div>

        <div className="p-8 pt-6">
          <h2 className="text-[20px] font-bold mb-1 text-[#2D2D2D]">All Announcements</h2>
          <p className="text-[13px] text-gray-400 mb-8">
            View and manage all announcements you have published.
          </p>

          {isListLoading && announcements.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No announcements published yet.</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div
                  key={ann.announcement_id}
                  className="flex items-center justify-between p-6 border border-gray-200 rounded-[8px] bg-white transition-colors hover:border-gray-300"
                >
                  <div className="flex flex-col flex-1 pl-1">
                    <h3 className="text-[16px] font-bold text-[#1A1A1A] leading-tight mb-1">
                      {ann.title}
                    </h3>
                    <p className="text-[13px] text-[#9CA3AF] mb-3">
                      {ann.body}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
                        Target : {renderTargetRoles(ann.target_roles)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(ann.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => promptDelete(ann.announcement_id)}
                      className="ml-4 p-2 text-[#FF4C24] hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-[20px] h-[20px]" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({isOpen: false, id: null})}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
