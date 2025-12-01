import { Star, StarHalf } from "lucide-react"

interface RatingStarsProps {
  rating: number
  className?: string
}

export default function RatingStars({ rating, className = "" }: RatingStarsProps) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)

  return (
    <div className={`flex items-center gap-0.5 text-amber-500 ${className}`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} className="h-4 w-4 fill-current" />
      ))}
      {half && <StarHalf className="h-4 w-4 fill-current" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="h-4 w-4" />
      ))}
    </div>
  )
}
