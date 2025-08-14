// src/components/ExampleAuthButton.tsx
import { useAuthGate } from "../../auth/useAuthGate"

const ExampleAuthButton: React.FC = () => {
  const { guard } = useAuthGate()

  const buyNow = guard(async () => {
    console.log("Using Button")
  })

  return (
    <button onClick={buyNow}>
      ซื้อเลย
    </button>
  )
}

export default ExampleAuthButton
