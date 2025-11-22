export default function StoreInfoTab() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-black">
        {/* LEFT FORM */}
        <div className="space-y-5">
          <div>
            <label className="block font-semibold mb-1 ">ชื่อร้าน</label>
            <input
              type="text"
              placeholder="ช่างกล่องขนมหวาน"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">คำอธิบายร้าน</label>
            <textarea
              placeholder="ร้านเบเกอรี่โฮมเมด..."
              className="w-full border rounded-lg p-3 h-28"
            />
          </div>
        </div>

        {/* RIGHT LOGO */}
        <div className="flex flex-col items-center justify-start">
          <p className="font-semibold mb-2">โลโก้ร้าน</p>
          <img
            src="/images/brownie.jpg"
            alt="store-logo"
            className="w-40 h-40 object-cover rounded-full border shadow"
          />
        </div>
      </div>
      <div className="w-full align-middle flex justify-center">
        <button className=" bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600">
          แก้ไขข้อมูลร้านค้า
        </button>
      </div>
    </>
  )
}
