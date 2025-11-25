import { useParams } from "react-router-dom";
import { Star, Share2, UserPlus } from "lucide-react";

// ===== Types =====
type Store = {
  id: string;
  name: string;
  logoUrl: string;
  rating: number;
  reviewCount: number;
  followerCount: number;
  description?: string;
};

type StoreProduct = {
  id: string;
  name: string;
  price: number;
  sold: number;
  rating: number;
  imageUrl: string;
};

// ===== Mock Data (เปลี่ยนเป็น API จริงภายหลัง) =====
const MOCK_STORE: Store = {
  id: "cookie-box",
  name: "ร้านช่างกล่องขนมหวาน",
  logoUrl:
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?q=80&w=400&auto=format&fit=crop",
  rating: 4.8,
  reviewCount: 1200,
  followerCount: 5600,
  description:
    "โฮมเมดเบเกอรี่หอมเนยสด สดใหม่จากเตาทุกวัน พร้อมเมนูบราวนี่ เค้ก และคุกกี้สูตรพิเศษของทางร้าน",
};

const MOCK_PRODUCTS: StoreProduct[] = [
  {
    id: "p1",
    name: "บราวนี่อบสดใหม่",
    price: 20,
    sold: 1500,
    rating: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1541976076758-7f636a0c6b49?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "p2",
    name: "คุกกี้มินิบ็อกโกแลตชิพ",
    price: 35,
    sold: 800,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1483691278019-cb7253bee49f?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "p3",
    name: "เค้กเรดเวลเวท",
    price: 80,
    sold: 450,
    rating: 4.7,
    imageUrl:
      "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "p4",
    name: "ชุดบราวนี่ลิลลี่ลา",
    price: 45,
    sold: 720,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1517244683847-7456b63c5969?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "p5",
    name: "ทาร์ตผลไม้รวม",
    price: 30,
    sold: 1200,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1509448613959-44d527dd5d86?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "p6",
    name: "ครัวซองต์เนยสด",
    price: 55,
    sold: 900,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?q=80&w=800&auto=format&fit=crop",
  },
];

// ===== Sub-components =====

function StoreHeader({ store }: { store: Store }) {
  return (
    <section className="rounded-2xl bg-white px-5 py-4 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden">
          <img
            src={store.logoUrl}
            alt={store.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">{store.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="font-medium text-gray-700">
                {store.rating.toFixed(1)}
              </span>
            </span>
            <span>{store.reviewCount.toLocaleString()} Reviews</span>
            <span>{store.followerCount.toLocaleString()} Followers</span>
          </div>
          {store.description && (
            <p className="mt-2 text-xs text-gray-500 max-w-xl">
              {store.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 self-start md:self-auto">
        <button className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-1.5 text-xs md:text-sm text-gray-700 hover:bg-gray-100">
          <Share2 className="h-4 w-4" />
          แชร์
        </button>
        <button className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-1.5 text-xs md:text-sm font-semibold text-white hover:bg-orange-600">
          <UserPlus className="h-4 w-4" />
          ติดตาม
        </button>
      </div>
    </section>
  );
}

function StoreTabs() {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <div className="flex gap-2 text-xs md:text-sm">
        <button className="rounded-full bg-orange-500 px-3 md:px-4 py-1.5 font-semibold text-white shadow-sm">
          สินค้าทั้งหมด
        </button>
        <button className="rounded-full px-3 md:px-4 py-1.5 text-gray-600 hover:bg-gray-100">
          โปรโมชั่น
        </button>
        <button className="rounded-full px-3 md:px-4 py-1.5 text-gray-600 hover:bg-gray-100">
          สินค้าแนะนำ
        </button>
      </div>

      <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
        <span className="text-gray-600">จัดเรียง:</span>
        <select className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700">
          <option>ขายดี</option>
          <option>ราคาต่ำ → สูง</option>
          <option>ราคาสูง → ต่ำ</option>
          <option>คะแนนสูงสุด</option>
        </select>
      </div>
    </div>
  );
}

function StoreProductCard({ product }: { product: StoreProduct }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition">
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p className="text-sm font-medium line-clamp-2">{product.name}</p>

        <p className="mt-1 text-sm">
          <span className="font-semibold text-orange-500">
            {product.price} บาท
          </span>
        </p>

        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>ขายแล้ว {product.sold.toLocaleString()} ชิ้น</span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        </div>

        <button className="mt-3 w-full rounded-full bg-orange-500 py-2 text-xs font-semibold text-white hover:bg-orange-600">
          🛒 เพิ่มลงตะกร้า
        </button>
      </div>
    </div>
  );
}

function StoreProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <StoreProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// ===== Main Page =====
export default function StorePage() {
  const { storeId } = useParams(); // เอาไปใช้เรียก API จริงได้ภายหลัง

  const store = MOCK_STORE; // TODO: เรียกจาก backend ด้วย storeId
  const products = MOCK_PRODUCTS;

  return (
    <div className="min-h-screen bg-neutral-900 py-6 md:py-10">
      <div className="mx-auto max-w-6xl rounded-3xl bg-[#f7f7f7] px-4 py-6 md:px-8 md:py-8">
        <StoreHeader store={store} />
        <StoreTabs />
        <StoreProductGrid products={products} />
      </div>
    </div>
  );
}
