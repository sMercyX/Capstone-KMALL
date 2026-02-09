interface PageHeaderProps {
  category: string
}

export default function PageHeader({ category }: PageHeaderProps) {
  const titleMap: Record<string, string> = {
    food: "Food & Drinks",
    clothing: "Clothes",
       "handmade-products": "Handmade Products",

  }

  return (
    <header className="text-center space-y-1">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
       {titleMap[category] || "Product Categories"}
      </h1>
    </header>
  )
}
