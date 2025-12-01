interface PageHeaderProps {
  category: string
}

export default function PageHeader({ category }: PageHeaderProps) {
  const titleMap: Record<string, string> = {
    food: "อาหารและเครื่องดื่ม (Food & Drinks)",
    clothing: "เสื้อผ้า (Clothes)",
    "handmade-products": "สินค้าแฮนด์เมด (Handmade Products)",
  }

  return (
    <header className="text-center space-y-1">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
        {titleMap[category] || "หมวดหมู่สินค้า"}
      </h1>
    </header>
  )
}
