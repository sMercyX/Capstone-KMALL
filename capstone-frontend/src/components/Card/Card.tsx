// components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`w-full rounded-2xl bg-[#F5F5F5] shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
