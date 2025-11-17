import { useMemo, useState } from "react";
import { Filter, ChevronDown, ChevronLeft, ChevronRight, Star, StarHalf, ShoppingCart, Heart, Eye } from "lucide-react";
import { Link, useParams } from "react-router-dom";

// ===== Types =====
type Product = {
  id: string;
  name: string;
  shop: string;
  price: number;
  rating: number;
  ratingCount: number;
  image: string;
  badge?: string;
  category: string;
};

// ===== Mock Data =====
const PRODUCTS: Product[] = [
  // --- Food & Drinks ---
  {
    id: "p1",
    name: "ข้าวคลุกน้ำพริกกะปิ",
    shop: "Twenty Yum",
    price: 50,
    rating: 4.2,
    ratingCount: 4231,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
    badge: "โปรโมชั่น",
    category: "food",
  },
  {
    id: "p2",
    name: "ชาเขียวปั่น",
    shop: "Kami",
    price: 65,
    rating: 4.1,
    ratingCount: 751,
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1200&auto=format&fit=crop",
    badge: "สินค้ามาใหม่",
    category: "food",
  },

  // --- Clothes ---
  {
    id: "c1",
    name: "เสื้อยืดลายมอเตอร์ไซค์",
    shop: "StreetStyle",
    price: 199,
    rating: 4.5,
    ratingCount: 912,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop",
    category: "clothes",
  },
  {
    id: "c2",
    name: "กางเกงยีนส์",
    shop: "UrbanDenim",
    price: 499,
    rating: 4.3,
    ratingCount: 221,
    image: "https://images.unsplash.com/photo-1593032465171-cf66f818d9d3?q=80&w=1200&auto=format&fit=crop",
    category: "clothes",
  },

  // --- Handmade ---
  {
    id: "h1",
    name: "กระเป๋าสานแฮนด์เมด",
    shop: "Craft Studio",
    price: 350,
    rating: 4.8,
    ratingCount: 84,
    image: "https://images.unsplash.com/photo-1582738412294-d4e6d2b1a2d6?q=80&w=1200&auto=format&fit=crop",
    category: "handmade",
  },
  {
    id: "h2",
    name: "พวงกุญแจไม้แกะสลัก",
    shop: "Local Art",
    price: 129,
    rating: 4.6,
    ratingCount: 40,
    image: "https://images.unsplash.com/photo-1609521318535-678e9c5a6c9f?q=80&w=1200&auto=format&fit=crop",
    category: "handmade",
  },
];

// ===== Utilities =====
const baht = (n: number) => `${n.toLocaleString()} บาท`;

type SortKey = "popular" | "price-asc" | "price-desc" | "rating";

// ===== Components =====
function PageHeader({ category }: { category: string }) {
  const titleMap: Record<string, string> = {
    food: "อาหารและเครื่องดื่ม (Food & Drinks)",
    clothes: "เสื้อผ้า (Clothes)",
    handmade: "สินค้าแฮนด์เมด (Handmade Products)",
  };
  return (
    <header className="text-center space-y-1">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
        {titleMap[category] || "หมวดหมู่สินค้า"}
      </h1>
    </header>
  );
}

function Toolbar({ total, sort, onChangeSort }: { total: number; sort: SortKey; onChangeSort: (s: SortKey) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-600">Showing all {total} results</p>
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
          <Filter className="h-4 w-4" /> Filter
        </button>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onChangeSort(e.target.value as SortKey)}
            className="appearance-none rounded-xl border bg-white px-3 py-2 text-sm pr-8 hover:bg-gray-50"
          >
            <option value="popular">Sort by: Popular</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Rating</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} className="h-4 w-4 fill-current" />
      ))}
      {half && <StarHalf className="h-4 w-4 fill-current" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="h-4 w-4" />
      ))}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-black/5">{children}</span>;
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-xl transition">
      {/* IMAGE */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Action Buttons */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 gap-3">
          {/* Favorite */}
          <button className="h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition">
            <Heart className="h-5 w-5 text-gray-700" />
          </button>

          {/* Add to cart */}
          <button className="h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
          </button>

          {/* View (link to product) */}
          <Link
            to={`/product/${product.id}`}
            className="h-12 w-12 rounded-full bg-orange-500 shadow-md flex items-center justify-center hover:scale-110 transition"
          >
            <Eye className="h-5 w-5 text-white" />
          </Link>
        </div>
      </div>

      {/* PRODUCT INFO */}
      <div className="space-y-2 px-3 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <RatingStars rating={product.rating} />
          <span className="text-xs text-gray-500">
            ({product.ratingCount.toLocaleString()})
          </span>
        </div>

        <h3 className="line-clamp-1 text-sm font-semibold">{product.name}</h3>
        <p className="text-xs text-gray-500 line-clamp-1">{product.shop}</p>
        <p className="pt-1 font-semibold text-rose-600">
          {product.price} บาท
        </p>
      </div>
    </div>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav className="mt-6 flex items-center justify-center gap-2">
      <button onClick={() => onPage(Math.max(1, page - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border hover:bg-gray-50 disabled:opacity-50" disabled={page === 1}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`h-9 w-9 rounded-full text-sm font-medium transition ${p === page ? "bg-gray-900 text-white shadow" : "border hover:bg-gray-50"}`}
        >
          {p}
        </button>
      ))}
      <button onClick={() => onPage(Math.min(totalPages, page + 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border hover:bg-gray-50 disabled:opacity-50" disabled={page === totalPages}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ===== Default Export =====
export default function CategoryPage() {
  const { category } = useParams(); // path: /category/:category
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("popular");

  const filtered = PRODUCTS.filter((p) => p.category === category);
  const pageSize = 12;

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sort) {
      case "price-asc":
        copy.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        copy.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        copy.sort((a, b) => b.rating - a.rating);
        break;
      default:
        copy.sort((a, b) => b.ratingCount - a.ratingCount);
    }
    return copy;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const start = (page - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <PageHeader category={category || "food"} />
      <div className="mt-6">
        <Toolbar total={filtered.length} sort={sort} onChangeSort={setSort} />
      </div>
      <div className="mt-4 md:mt-6">
        <ProductGrid products={visible} />
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </main>
  );
}
