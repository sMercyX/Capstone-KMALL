import { motion, useAnimationFrame, useMotionValue } from "motion/react"
import { useRef, useState, useEffect } from "react"

// Highly optimized images (lower resolution & quality for smooth carousel)
const images = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60", // Food
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=500&q=60", // Apparel
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=60", // Tech
  "https://images.unsplash.com/photo-1511499767350-a1590fdb7ca7?auto=format&fit=crop&w=500&q=60", // Accessories
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=500&q=60", // Books
  "https://images.unsplash.com/photo-1525966222134-fcfa99b2ae77?auto=format&fit=crop&w=500&q=60", // Gadgets
]

// Duplicate images to create a seamless infinite loop
const allImages = [...images, ...images, ...images]

export default function LandingCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const dragVelocity = useMotionValue(0) // Momentum/Inertia value
  
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [setWidth, setSetWidth] = useState(0)
  
  const baseSpeed = 1.0 // Base auto scroll speed
  const friction = 0.96 // Momentum decay rate (0.95-0.98 is best)

  // Measure the width once on mount and on resize
  useEffect(() => {
    const measure = () => {
        if (containerRef.current) {
            setSetWidth(containerRef.current.scrollWidth / 3)
        }
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useAnimationFrame((_t, delta) => {
    if (!setWidth) return
    
    // 1. Calculate decay of momentum
    let currentDragV = dragVelocity.get()
    
    // If not dragging, decay the momentum velocity
    if (!isDragging) {
        currentDragV *= friction
        if (Math.abs(currentDragV) < 0.1) currentDragV = 0
        dragVelocity.set(currentDragV)
    }

    // 2. Skip auto-movement while dragging (drag handles this)
    if (isDragging) return
    if (isHovered && currentDragV === 0) return 

    const currentX = x.get()
    
    // 3. Move x by combining baseSpeed and current momentum
    // Note: baseSpeed moves left (negative), so we subtract it.
    // Momentum (currentDragV) is added directly based on drag direction.
    let nextX = currentX - (baseSpeed * (delta / 16.67)) + (currentDragV * (delta / 16.67))
    
    // 4. Seamless loop reset
    if (nextX <= -setWidth) {
      nextX += setWidth
    } else if (nextX >= 0) {
      nextX -= setWidth
    }
    
    x.set(nextX)
  })

  // Capture velocity during drag
  const handleDrag = (_: any, info: any) => {
    // Convert px/ms to pixels per frame at 60fps for easier blending
    dragVelocity.set(info.delta.x * 2.5) 
  }

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false)
    // Capture the final velocity from the drag end info
    // Frame-based velocity (approx. info.velocity.x / 60)
    dragVelocity.set(info.velocity.x / 40) 
    
    if (!setWidth) return
    const currentX = x.get()
    if (currentX <= -setWidth) {
      x.set(currentX + setWidth)
    } else if (currentX >= 0) {
      x.set(currentX - setWidth)
    }
  }

  return (
    <div className="w-full overflow-hidden select-none py-20 relative isolate">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1/2 bg-orange-500/5 blur-[120px] -z-10 pointer-events-none" />
      
      <motion.div
        ref={containerRef}
        className="flex gap-8 cursor-grab active:cursor-grabbing px-4"
        style={{ 
            x,
            willChange: "transform"
        }}
        drag="x"
        onDragStart={() => setIsDragging(true)}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {allImages.map((src, index) => (
          <motion.div
            key={index}
            className="flex-shrink-0 w-[220px] md:w-[300px] aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.12)] bg-white border border-gray-100/50"
            whileHover={{ 
                scale: 1.04, 
                rotateZ: index % 2 === 0 ? 1 : -1,
                boxShadow: "0 40px 80px rgba(255,90,54,0.15)"
            }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            <img
              src={src}
              alt={`Premium Showcase ${index}`}
              className="w-full h-full object-cover pointer-events-none"
              loading="eager"
              decoding="async"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
