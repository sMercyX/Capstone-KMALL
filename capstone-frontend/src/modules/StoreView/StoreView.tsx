import React from 'react';
import { Star, ShoppingCart, MessageCircle, Store } from 'lucide-react';



const StoreView: React.FC = () => {
  // Mock data for the store and products
  const storeData = {
    name: "ร้านช่างกล้องขนมหวาน",
    bannerUrl: "https://images.unsplash.com/photo-1551024709-8f237c2045b5?q=80&w=1770&auto=format&fit=crop",
    logoUrl: "https://i.pinimg.com/736x/4d/00/a4/4d00a4267cce716db9f8818477ecb391.jpg",
    rating: 4.8,
    reviews: 1200,
    followers: 5600,
  };

  const products = [
    {
      id: 1,
      name: "บราวนี่อบสดใหม่",
      price: 20,
      imageUrl: "https://i.pinimg.com/736x/d8/5f/c1/d85fc17985271b6624a37625d6620c99.jpg",
      rating: 5,
      sold: 1500,
    },
    {
      id: 2,
      name: "คุกกี้นิ่มช็อกโกแลตชิพ",
      price: 35,
      imageUrl: "https://i.pinimg.com/564x/ec/87/01/ec8701a487a02331a22532a82f102c1f.jpg",
      rating: 4.9,
      sold: 800,
    },
    {
      id: 3,
      name: "เค้กเรดเวลเวท",
      price: 80,
      imageUrl: "https://i.pinimg.com/564x/3a/78/4b/3a784b8a0669345a3a23d18f254242f5.jpg",
      rating: 4.7,
      sold: 450,
    },
    {
      id: 4,
      name: "ชูครีมวานิลลา",
      price: 45,
      imageUrl: "https://i.pinimg.com/564x/9e/2a/f9/9e2af97d1083a1a2b45a0b7859d1a2a9.jpg",
      rating: 4.8,
      sold: 720,
    },
    {
        id: 5,
        name: "ทาร์ตไข่โปรตุเกส",
        price: 30,
        imageUrl: "https://i.pinimg.com/564x/7b/5b/1b/7b5b1b4b3e3b3b3b3b3b3b3b3b3b3b3b.jpg",
        rating: 4.9,
        sold: 1200,
    },
    {
        id: 6,
        name: "ครัวซองต์เนยสด",
        price: 55,
        imageUrl: "https://i.pinimg.com/564x/5f/a1/f1/5fa1f1b9b7e9b5b5b5b5b5b5b5b5b5b5.jpg",
        rating: 4.8,
        sold: 900,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="w-full h-48 bg-cover bg-center" style={{ backgroundImage: `url(${storeData.bannerUrl})` }}></div>
      
      <div className="max-w-[calc(100%-110px)] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end -mt-16">
          <div className="flex items-center bg-white p-2 rounded-md shadow-lg">
            <img src={storeData.logoUrl} alt={storeData.name} className="w-24 h-24 rounded-md border-4 border-white" />
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-800">{storeData.name}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <Star size={16} className="text-yellow-400 fill-current" />
                <span className="ml-1 font-semibold">{storeData.rating}</span>
                <span className="mx-2">|</span>
                <span>{storeData.reviews.toLocaleString()} Reviews</span>
                <span className="mx-2">|</span>
                <span>{storeData.followers.toLocaleString()} Followers</span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-5 rounded-md hover:bg-gray-50 flex items-center gap-2">
              <MessageCircle size={18} /> แชทเลย
            </button>
            <button className="bg-orange-500 text-white font-semibold py-2 px-5 rounded-md hover:bg-orange-600 flex items-center gap-2">
              <Store size={18} /> ติดตาม
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">สินค้าทั้งหมด</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden group transform hover:-translate-y-1 transition-transform duration-300">
                <div className="w-full h-48 overflow-hidden">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 truncate">{product.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xl font-bold text-orange-500">{product.price} บาท</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <Star size={16} className="text-yellow-400 fill-current" />
                      <span className="ml-1">{product.rating}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">ขายแล้ว {product.sold.toLocaleString()} ชิ้น</div>
                  <button className="w-full mt-4 bg-orange-500 text-white font-semibold py-2 rounded-md hover:bg-orange-600 flex items-center justify-center gap-2">
                    <ShoppingCart size={18} />
                    เพิ่มลงตะกร้า
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreView;
