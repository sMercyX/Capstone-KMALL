// src/components/MapKmuttButton/MapKmuttButton.tsx

export default function MapKmuttButton() {
  return (
    <a
      href="https://bgm.kmutt.ac.th/view.php?page=map&id=1"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors font-semibold"
    >
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-white text-sm">
        MAP KMUTT
      </span>
    </a>
  )
}
