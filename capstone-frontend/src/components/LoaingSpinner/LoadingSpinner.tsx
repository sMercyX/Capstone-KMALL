export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full animate-fadeIn">
      {/* วงกลมหมุนแบบไล่เฉดสี */}
      <div
        className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin mb-4"
        style={{
          borderColor: "rgba(255,90,41,0.25)",
          borderTopColor: "#FF5A29",
        }}
      ></div>

      {/* ข้อความ Loading... กระพริบเบา ๆ */}
      <p className="text-orange-500 font-semibold text-lg tracking-wide animate-pulse">
        Loading...
      </p>
    </div>
  )
}
