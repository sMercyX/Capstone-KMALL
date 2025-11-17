import { useMemo } from "react"
import { ChevronRight, Star } from "lucide-react"
import { Link } from "react-router-dom"
import SectionCard from "../../components/Card/SectionCard"


// import { ReactComponent as HamburgerIcon } from "../../assets/hamburger.svg"
type Product = {
  id: string
  name: string
  image: string
  badge?: number
}

type Category = {
  id: string
  name: string
  image: string
}

const categories: Category[] = [
  { id: "food", name: "อาหาร", image: "/assets/cat-food.png" },
  { id: "shirt", name: "เสื้อผ้า", image: "/assets/cat-shirt.png" },
  { id: "gadget", name: "สินค้านวัตกรรม", image: "/assets/cat-gadget.png" },
]

const bestSellers: Product[] = [
  { id: "p1", name: "นมชมพูสตรอว์เบอร์รี", image: "/assets/p1.png", badge: 1 },
  { id: "p2", name: "บะหมี่ลาวา", image: "/assets/p2.png", badge: 2 },
  { id: "p3", name: "ประคบสมุนไพร", image: "/assets/p3.png", badge: 3 },
  { id: "p4", name: "สร้อยคอ 4 จุด", image: "/assets/p4.png", badge: 4 },
  { id: "p5", name: "กางเกงยีนส์ขากว้าง", image: "/assets/p5.png", badge: 5 },
  { id: "p6", name: "เค้กมะพร้าวอ่อน", image: "/assets/p6.png", badge: 6 },
]

const recommended: Product[] = [
  { id: "r1", name: "กระโปรงพลีต", image: "/assets/r1.png", badge: 1 },
  { id: "r2", name: "ตุ๊กตาผ้า", image: "/assets/r2.png", badge: 2 },
  { id: "r3", name: "ผ้ากันเปื้อนใส่ครัว", image: "/assets/r3.png", badge: 3 },
  { id: "r4", name: "กางเกงยีนส์เข้ารูป", image: "/assets/r4.png", badge: 4 },
  { id: "r5", name: "บัวลอยไส้ทะลัก", image: "/assets/r5.png", badge: 5 },
  { id: "r6", name: "ชาเขียวปั่น", image: "/assets/r6.png", badge: 6 },
]

// —————————— UI atoms ——————————

function CategoryCard({ item }: { item: Category }) {
  return (
    <button className="group w-full max-w-[160px] rounded-2xl border border-orange-200 bg-white shadow-[0_8px_20px_rgba(255,102,0,0.15)] px-5 py-4 text-center hover:-translate-y-0.5 transition">
      <div className="mx-auto h-16 w-16 rounded-full bg-orange-50 grid place-items-center overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="h-12 w-12 object-contain"
        />
      </div>
      <div className="mt-3 font-medium text-gray-800">{item.name}</div>
    </button>
  )
}

function ProductCard({ item }: { item: Product }) {
  return (
    <Link
      to={`/product/${item.id}`}
      className="relative flex w-[160px] flex-col items-center rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition"
    >
      {/* badge number */}
      {typeof item.badge === "number" && (
        <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-orange-500 text-white text-xs font-semibold">
          {item.badge}
        </span>
      )}

      <div className="h-24 w-24 overflow-hidden rounded-lg bg-gray-50">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mt-3 text-center text-sm text-gray-700 line-clamp-2">
        {item.name}
      </div>
    </Link>
  )
}

// —————————— Page ——————————
export default function Dashboard() {
  // แทนด้วยค่าจาก AuthContext ได้ เช่น const { user } = useAuth()
  const userName = useMemo(() => "NITCHAN", [])
  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-400 to-orange-600 p-[2px] shadow-[0_10px_30px_rgba(255,102,0,0.25)]">
        <div className="rounded-2xl bg-white">
          <div
            className="relative h-40 w-full overflow-hidden rounded-2xl bg-[url('/assets/banner-sushi.jpg')] bg-cover bg-center"
            role="img"
            aria-label="สินค้าเด่นประจำเดือน"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-transparent" />
            <div className="absolute left-6 top-1/2 -translate-y-1/2">
              <div className="text-gray-800">สินค้ายอดฮิต !!</div>
              <div className="text-2xl font-extrabold text-gray-900">
                ประจำเดือน
              </div>
              <Link
                to="/collections/top"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium shadow hover:bg-white"
              >
                ดูทั้งหมด <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Greeting + Categories */}
      <div className="text-center">
        <div className="text-xs text-orange-500">
          สวัสดี {userName} | ยินดีต้อนรับ!
        </div>
        <h2 className="mt-1 text-2xl font-extrabold">
          KMALL - <span className="text-orange-600">KMUTT Marketplace</span>
        </h2>

        <div className="mt-5 flex flex-wrap items-stretch justify-center gap-4">
          {categories.map((c) => (
            <CategoryCard key={c.id} item={c} />
          ))}
        </div>
      </div>

      {/* Best sellers */}
      <SectionCard title="สินค้ายอดฮิต KMALL">
        <div className="flex flex-wrap gap-4">
          {bestSellers.map((p) => (
            <ProductCard key={p.id} item={p} />
          ))}
        </div>
      </SectionCard>

      {/* Recommended */}
      <SectionCard title="สินค้าแนะนำ">
        <div className="flex flex-wrap gap-4">
          {recommended.map((p) => (
            <ProductCard key={p.id} item={p} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
