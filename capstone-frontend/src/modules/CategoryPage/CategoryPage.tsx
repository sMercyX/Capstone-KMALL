import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star,
  StarHalf,
  ShoppingCart,
  Heart,
  Eye,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useProductApi, type Product } from "../../api/productApi";
import { useProductListStore } from "../../stores/catagoriesStore";


// ====================== UTIL MAPPING ======================
type SortKey = "popular" | "price-asc" | "price-desc" | "rating";

function mapCategory(category?: string) {
  if (!category) return "food";
  switch (category) {
    case "food":
      return "food";
    case "clothe":
    case "clothes":
      return "clothing";
    case "handmade":
      return "handmade-products";
    default:
      return "food";
  }
}

function mapCategoryId(category?: string) {
  switch (category) {
    case "food":
      return 1;
    case "clothe":
    case "clothes":
    case "clothing":
      return 2;
    case "handmade":
      return 3;
    default:
      return 1;
  }
}

// ====================== HEADER ======================
function PageHeader({ category }: { category: string }) {
  const titleMap: Record<string, string> = {
    food: "อาหารและเครื่องดื่ม (Food & Drinks)",
    clothe: "เสื้อผ้า (Clothes)",
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

// ====================== TOOLBAR ======================
function Toolbar({
  total,
  sort,
  onChangeSort,
}: {
  total: number;
  sort: SortKey;
  onChangeSort: (s: SortKey) => void;
}) {
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
            className="appearance-none rounded-xl border bg-white px-3 py-2 pr-8 text-sm hover:bg-gray-50"
          >
            <option value="popular">Sort by: Popular</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Rating</option>
          </select>

          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

// ====================== RATING STARS ======================
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

// ====================== PRODUCT CARD ======================
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-xl transition">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.image || "https://via.placeholder.com/300"}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />

        <div className="absolute inset-0 bg-black/40 opacity-0 transition duration-300 group-hover:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 translate-y-4 transition duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <button className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition">
            <Heart className="h-5 w-5 text-gray-700" />
          </button>

          <button className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
          </button>

          <Link
            to={`/product/${product.slug}`}
            className="h-12 w-12 rounded-full bg-orange-500 shadow flex items-center justify-center hover:scale-110 transition"
          >
            <Eye className="h-5 w-5 text-white" />
          </Link>
        </div>
      </div>

      <div className="px-3 pb-3 pt-2 space-y-2">
        <div className="flex items-center gap-2">
          <RatingStars rating={4} />
          <span className="text-xs text-gray-500">(120)</span>
        </div>

        <h3 className="text-sm font-semibold line-clamp-1">{product.name}</h3>

        <p className="text-xs text-gray-500 line-clamp-1">
          {product.shop || "ร้านค้าทั่วไป"}
        </p>

        <p className="pt-1 font-semibold text-rose-600">
          {product.price ? `${product.price} บาท` : "—"}
        </p>
      </div>
    </div>
  );
}

// ====================== PRODUCT GRID ======================
function ProductGrid({ items }: { items: Product[] }) {
  if (!items.length)
    return (
      <div className="py-10 text-center text-gray-500">
        ยังไม่มีสินค้าในหมวดนี้
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ProductCard key={item.id} product={item} />
      ))}
    </div>
  );
}

// ====================== PAGINATION ======================
function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="mt-6 flex items-center justify-center gap-2">
      <button
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`h-9 w-9 rounded-full text-sm ${
            p === page
              ? "bg-gray-900 text-white shadow"
              : "border hover:bg-gray-50"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
        className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ====================== MAIN PAGE ======================
export default function CategoryPage() {
  const { category: routeCategory } = useParams();

  const apiCategory = mapCategory(routeCategory);
  const apiCategoryId = mapCategoryId(routeCategory);

  const [sort, setSort] = useState<SortKey>("popular");

  const {
    items,
    pageIndex,
    pageSize,
    total,
    isLoading,
    error,
    setPageIndex,
    startLoading,
    setPageData,
    setError,
    reset,
  } = useProductListStore();

  const { getProductsByCategory } = useProductApi();

  // reset เมื่อเปลี่ยนหมวด
  useEffect(() => {
    reset();
    setPageIndex(1);
  }, [apiCategory]);

  // fetch BE
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        startLoading();
        const res = await getProductsByCategory(
          apiCategory,
          pageIndex,
          pageSize,
          apiCategoryId
        );

        if (!cancelled) setPageData(res.data);
      } catch (err) {
        if (!cancelled) setError("โหลดสินค้าล้มเหลว");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiCategory, apiCategoryId, pageIndex, pageSize]);

  // sort FE
  const sortedItems = useMemo(() => {
    const copy = [...items];
    switch (sort) {
      case "price-asc":
        return copy.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case "price-desc":
        return copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "rating":
        return copy; // rating = 4 fixed
      default:
        return copy; // backend order
    }
  }, [items, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <PageHeader category={routeCategory || "food"} />

      <div className="mt-6">
        <Toolbar
          total={total || sortedItems.length}
          sort={sort}
          onChangeSort={setSort}
        />
      </div>

      <div className="mt-6">
        {isLoading && !items.length ? (
          <div className="py-10 text-center text-gray-500">
            กำลังโหลดสินค้า...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-500">{error}</div>
        ) : (
          <ProductGrid items={sortedItems} />
        )}
      </div>

      <Pagination
        page={pageIndex}
        totalPages={totalPages}
        onPage={setPageIndex}
      />
    </main>
  );
}
