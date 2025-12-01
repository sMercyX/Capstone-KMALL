import { useEffect, useState } from "react"
import { useStoreApi, type addStoreData } from "../../api/storeApi"
import Card from "./Card"
import { Link } from "react-router-dom"
import { resolveImageUrl } from "../../utils/resolve"

interface StoreInfoCardProps {
  storeId: number
}

export default function StoreInfoCard({ storeId }: StoreInfoCardProps) {
  const { getStoreDetail } = useStoreApi()
  const [store, setStore] = useState<addStoreData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!storeId) return

    async function fetchStore() {
      try {
        setIsLoading(true)
        const res = await getStoreDetail(storeId)
        setStore(res.data)
      } catch (err) {
        console.error("Failed to fetch store detail:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStore()
  }, [storeId])

  if (isLoading) {
    return (
      <Card className="mt-8 flex items-center justify-center p-6 rounded-3xl">
        <p className="text-gray-500 text-sm">กำลังโหลดข้อมูลร้านค้า...</p>
      </Card>
    )
  }

  if (!store) {
    return null
  }

  return (
    <Card className=" flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden">
             <img
                src={
                  store.profile_url
                    ? resolveImageUrl(store.profile_url)
                    : "/images/default-store.png"
                }
                alt={store.name}
                className="h-full w-full object-cover"
              />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{store.name}</p>
          <p className="text-xs text-gray-500">{store.description}</p>
        </div>
      </div>

      <Link to={`/store/${storeId}`} className="flex gap-3">
        <button className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">
            ดูร้านค้า
          </button>
        </Link>
    </Card>
  )
}
