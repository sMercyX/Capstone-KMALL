import { useState, useRef, useEffect } from "react"
import { motion, useMotionValue, useAnimationFrame } from "framer-motion"

const images = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1517705008128-361805f42e8a?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1467453278243-781dc4f676a1?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1526170315870-ef0397181393?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=500&q=80",
]

// To ensure seamless loop, we triple the items
const items = [...images, ...images, ...images]

export default function LandingCarousel() {
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  const x = useMotionValue(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Auto-scrolling logic
  useAnimationFrame((_, delta) => {
    if (isPaused || isDragging) return

    // Move left continuously
    const moveBy = -1.5 * (delta / 16) // ~1.5px per frame @ 60fps
    const currentX = x.get()
    let nextX = currentX + moveBy

    // Infinite wrap logic
    // Track width for one set of images
    if (trackRef.current) {
        const totalWidth = trackRef.current.scrollWidth
        const oneSetWidth = totalWidth / 3
        
        // Wrap back to center set if we go too far left
        if (nextX <= -oneSetWidth * 2) {
            nextX += oneSetWidth
        }
        // Wrap to center set if we go too far right (dragging)
        else if (nextX >= -oneSetWidth) {
           // We keep it in the second set for safety
        }
    }

    x.set(nextX)
  })

  // Sync drag with wrap logic
  const handleDragUpdate = () => {
    if (!trackRef.current) return
    const totalWidth = trackRef.current.scrollWidth
    const oneSetWidth = totalWidth / 3
    const currentX = x.get()

    if (currentX <= -oneSetWidth * 2) {
      x.set(currentX + oneSetWidth)
    } else if (currentX >= -oneSetWidth) {
      x.set(currentX - oneSetWidth)
    }
  }

  // Initial centering
  useEffect(() => {
    if (trackRef.current) {
        const oneSetWidth = trackRef.current.scrollWidth / 3
        x.set(-oneSetWidth)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full select-none relative isolate overflow-hidden">
      <motion.div 
        ref={trackRef}
        drag="x"
        dragMomentum={false}
        dragElastic={0.05}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
            setIsDragging(false)
            // Ensure baseX or other logic doesn't cause a jump
        }}
        onDrag={handleDragUpdate}
        style={{ x }}
        className="flex gap-4 sm:gap-6 h-full w-max py-4 sm:py-6 cursor-grab active:cursor-grabbing"
      >
        {items.map((src, index) => (
          <motion.div 
            key={index}
            onPointerEnter={() => setIsPaused(true)}
            onPointerLeave={() => setIsPaused(false)}
            whileHover={{ 
                scale: 1.04, 
                rotateZ: index % 2 === 0 ? 1 : -1,
                boxShadow: "0 40px 80px rgba(255,90,54,0.15)"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="h-full aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.08)] bg-white cursor-pointer"
          >
            <img
              src={src}
              alt={`KMALL Showcase ${index}`}
              className="w-full h-full object-cover pointer-events-none"
              loading="lazy"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
