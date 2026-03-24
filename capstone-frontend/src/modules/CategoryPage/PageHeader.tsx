interface PageHeaderProps {
  category: string
}

export default function PageHeader({ category }: PageHeaderProps) {
  return (
    <header className="text-center space-y-1">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
       {category || "Product Categories"}
      </h1>
    </header>
  )
}
