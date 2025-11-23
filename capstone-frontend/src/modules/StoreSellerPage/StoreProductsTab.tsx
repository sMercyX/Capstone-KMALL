import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "../../components/Pagination/Pagination";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
};

const ALL_PRODUCTS: Product[] = [
  // ใส่ mock เดิมของคุณ หรือซ้ำ ๆ เพื่อให้เห็นหลายหน้า
  {
    id: 1,
    name: "Red Tape Sports Shoes for Men",
    description: "รองเท้าวิ่ง ใส่แล้วดูดีใส่สบายตลอดวัน",
    price: 25,
    imageUrl:
      "https://images.unsplash.com/photo-1528701800489-20be3c30c1d5?w=400&auto=format&fit=crop",
    isActive: true,
  },
  {
    id: 2,
    name: "Fastrack FS1 Pro Smartwatch",
    description: "นาฬิกาอัจฉริยะดีไซน์ล้ำ จอภาพสีสบายตา",
    price: 50,
    imageUrl:
      "https://images.unsplash.com/photo-1519744346363-dc63c9b5b43b?w=400&auto=format&fit=crop",
    isActive: true,
  },
  {
    id: 3,
    name: "Leriya Fashion Men's Shirt",
    description: "เสื้อเชิ้ตลายดอกแนวฮาวาย งานผ้านิ่ม ใส่สบาย",
    price: 79,
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&auto=format&fit=crop",
    isActive: false,
  },
  {
    id: 4,
    name: "Leriya Fashion Men's Shirt",
    description: "เสื้อเชิ้ตลายดอกแนวฮาวาย งานผ้านิ่ม ใส่สบาย",
    price: 79,
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&auto=format&fit=crop",
    isActive: false,
  },
  // สมมติใส่เพิ่มให้มีหลาย ๆ ชิ้นก็ได้
];

export function StoreProductsTab() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3; // แสดงกี่ชิ้นต่อหน้า

  const totalPages = Math.max(
    1,
    Math.ceil(ALL_PRODUCTS.length / pageSize)
  );

  const start = (currentPage - 1) * pageSize;
  const currentItems = ALL_PRODUCTS.slice(start, start + pageSize);

  const toggleActive = (id: number) => {
    // TODO: ค่อยเปลี่ยนเป็น state จาก backend ก็ได้
    console.log("toggle active", id);
  };

  const handleEdit = (id: number) => {
    console.log("edit product", id);
  };

  const handleDelete = (id: number) => {
    console.log("delete product", id);
  };

  return (
    <>
      <div className="border border-[#e0e0e0] rounded-2xl p-6 bg-white">
        <h2 className="font-semibold text-lg mb-4">สินค้าทั้งหมด</h2>

        <div className="space-y-6">
          {currentItems.map((product) => (
            <div
              key={product.id}
              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              {/* รูป + รายละเอียด */}
              <div className="flex items-start gap-4">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover flex-shrink-0"
                />

                <div className="space-y-1">
                  <p className="font-semibold text-sm md:text-base">
                    {product.name}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">
                    {product.description}
                  </p>
                  <p className="text-sm md:text-base mt-1">
                    {product.price} บาท
                  </p>
                </div>
              </div>

              {/* ปุ่ม + Toggle */}
              <div className="flex items-center justify-between md:justify-end gap-6 md:min-w-[220px]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleEdit(product.id)}
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    <Pencil className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4 text-gray-700" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      product.isActive ? "text-sky-600" : "text-red-500"
                    }`}
                  >
                    {product.isActive ? "แสดงสินค้า" : "ซ่อนสินค้า"}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleActive(product.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      product.isActive ? "bg-sky-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        product.isActive ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Pagination แบบในรูป */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        className="mt-6"
      />
    </>
  );
}
