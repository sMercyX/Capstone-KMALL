import { useEffect, useState } from "react"
import { useStoreStore } from "../../stores/storeStore"
import {
  useOrderSellerApi,
  type StoreSummaryResponse,
} from "../../api/orderSellerApi"
// Unused imported Card
// import Card from "../../components/Card/Card"
import {
  Users,
  Package,
  LineChart,
  History,
  X,
  Award,
  CalendarDays,
  RefreshCw
} from "lucide-react"

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Line } from "react-chartjs-2"
import dayjs from "dayjs"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type Granularity = "daily" | "monthly" | "yearly" | "all_time"

export default function SellerDashboardPage() {
  const { store, fetchStore } = useStoreStore()
  const { getOrderSummaries } = useOrderSellerApi()

  // Data state
  const [summary, setSummary] = useState<StoreSummaryResponse | null>(null)
  const [allTimeSummary, setAllTimeSummary] = useState<StoreSummaryResponse | null>(
    null
  )
  const [loading, setLoading] = useState(true)

  // Filter state for Chart
  const [granularity, setGranularity] = useState<Granularity>("all_time")
  const [selectedMonth, setSelectedMonth] = useState<number>(dayjs().month() + 1) // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year())
  
  // Dropdown UI toggles
  const [isMonthOpen, setIsMonthOpen] = useState(false)
  const [isYearOpen, setIsYearOpen] = useState(false)

  // Load store if missing
  useEffect(() => {
    if (!store?.id) fetchStore()
  }, [store?.id, fetchStore])

  // Load All-Time (for cards) and Current Range (for chart/table)
  useEffect(() => {
    if (!store?.id) return

    async function loadData() {
      setLoading(true)
      try {
        // 1. All time data (for summary cards)
        if (!allTimeSummary) {
          const resAll = await getOrderSummaries(store!.id, "all_time")
          if (resAll.data) setAllTimeSummary(resAll.data)
        }

        // 2. Chart / Table data (filtered)
        let fromUrl: string | undefined
        let toUrl: string | undefined

        if (granularity === "daily") {
          fromUrl = dayjs(`${selectedYear}-${selectedMonth}-01`).format("YYYY-MM-DD")
          toUrl = dayjs(fromUrl).endOf("month").format("YYYY-MM-DD")
        } else if (granularity === "monthly") {
          fromUrl = dayjs(`${selectedYear}-01-01`).format("YYYY-MM-DD")
          toUrl = dayjs(`${selectedYear}-12-31`).format("YYYY-MM-DD")
        }

        const resFiltered = await getOrderSummaries(
          store!.id,
          granularity,
          fromUrl,
          toUrl
        )
        if (resFiltered.data) setSummary(resFiltered.data)

      } catch (err) {
        console.error("Failed to load dashboard data", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [store?.id, granularity, selectedMonth, selectedYear])

  const handleReset = () => {
    setGranularity("all_time")
    setSelectedMonth(dayjs().month() + 1)
    setSelectedYear(dayjs().year())
  }

  // ---- Chart Data Generation ----
  const rawData = summary?.revenue_by_period || []

  // Generate labels and padding based on granularity
  const chartLabels: string[] = []
  const chartDataRevenues: number[] = []
  const chartDataOrders: number[] = []

  if (granularity === "daily") {
    const daysInMonth = dayjs(`${selectedYear}-${selectedMonth}-01`).daysInMonth()
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDay = dayjs(`${selectedYear}-${selectedMonth}-${i}`)
      chartLabels.push(currentDay.format("D"))
      const match = rawData.find((r) => 
        dayjs(r.date).date() === i && 
        dayjs(r.date).month() + 1 === selectedMonth && 
        dayjs(r.date).year() === selectedYear
      )
      chartDataRevenues.push(match ? Number(match.revenue) : 0)
      chartDataOrders.push(match ? Number(match.orders) : 0)
    }
  } else if (granularity === "monthly") {
    for (let i = 1; i <= 12; i++) {
      const currentMonth = dayjs(`${selectedYear}-${i}-01`)
      chartLabels.push(currentMonth.format("MMM YYYY"))
      const match = rawData.find((r) => 
        dayjs(r.date).month() + 1 === i && 
        dayjs(r.date).year() === selectedYear
      )
      chartDataRevenues.push(match ? Number(match.revenue) : 0)
      chartDataOrders.push(match ? Number(match.orders) : 0)
    }
  } else {
    // all_time (dynamic based on actual data)
    const monthMap = new Map<string, { rev: number; ord: number }>()
    rawData.forEach((r) => {
      const ym = dayjs(r.date).format("YYYY-MM")
      if (!monthMap.has(ym)) monthMap.set(ym, { rev: 0, ord: 0 })
      const data = monthMap.get(ym)!
      data.rev += Number(r.revenue || 0)
      data.ord += Number(r.orders || 0)
    })

    const sortedKeys = Array.from(monthMap.keys()).sort()
    
    if (sortedKeys.length === 0) {
      for (let i = 11; i >= 0; i--) {
        const currentMonth = dayjs().subtract(i, "month")
        chartLabels.push(currentMonth.format("MMM YYYY"))
        chartDataRevenues.push(0)
        chartDataOrders.push(0)
      }
    } else {
      const minDate = dayjs(sortedKeys[0] + "-01")
      const maxDate = dayjs(sortedKeys[sortedKeys.length - 1] + "-01")
      
      let curr = minDate.clone()
      while (curr.isBefore(maxDate) || curr.isSame(maxDate, "month")) {
        const key = curr.format("YYYY-MM")
        chartLabels.push(curr.format("MMM YYYY"))
        if (monthMap.has(key)) {
          chartDataRevenues.push(monthMap.get(key)!.rev)
          chartDataOrders.push(monthMap.get(key)!.ord)
        } else {
          chartDataRevenues.push(0)
          chartDataOrders.push(0)
        }
        curr = curr.add(1, "month")
      }
    }
  }

  const lineChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Revenue",
        data: chartDataRevenues,
        borderColor: "#f97316", // orange-500
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 300)
          gradient.addColorStop(0, "rgba(249, 115, 22, 0.3)")
          gradient.addColorStop(1, "rgba(249, 115, 22, 0)")
          return gradient
        },
        fill: true,
        yAxisID: "y-revenue",
        tension: 0.4,
        pointBackgroundColor: "#f97316",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: "Orders",
        data: chartDataOrders,
        borderColor: "#3b82f6", // blue-500
        backgroundColor: "transparent",
        yAxisID: "y-orders",
        tension: 0.4,
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: { position: "top" as const, align: "end" as const },
      tooltip: {
        backgroundColor: "rgba(255, 107, 107, 0.9)",
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        callbacks: {
          label: (ctx: any) => {
             if(ctx.datasetIndex === 0) return ` Revenue: ฿${ctx.raw.toLocaleString()}`
             return ` Orders: ${ctx.raw}`
          }
        }
      }
    },
    scales: {
      "y-revenue": {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: { display: true, text: "Revenue (THB)" },
        grid: { drawOnChartArea: false },
      },
      "y-orders": {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        title: { display: true, text: "Orders" },
        grid: { drawOnChartArea: false },
      },
    },
  }

  if (loading && !allTimeSummary) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Dashboard...</div>
  }

  const cards = allTimeSummary?.cards || summary?.cards // fallback
  const topProducts = summary?.top_products || []

  return (
    <div className="p-0">
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-2">
          Store &gt; <span className="font-semibold text-gray-600">Dashboard</span>
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Overview your store sales information.
        </p>
      </div>

      {/* --- Stat Cards --- */}
      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Customers"
            value={(cards?.total_customers || 0).toLocaleString()}
            icon={<Users className="h-5 w-5 text-indigo-500" />}
            bgColor="bg-indigo-100"
          />
          <StatCard
            title="Items Sold"
            value={(cards?.total_items_sold || 0).toLocaleString()}
            icon={<Package className="h-5 w-5 text-amber-500" />}
            bgColor="bg-amber-100"
          />
          <StatCard
            title="Total Revenue"
            value={`฿${(cards?.total_revenue || 0).toLocaleString()}`}
            icon={<LineChart className="h-5 w-5 text-emerald-500" />}
            bgColor="bg-emerald-100"
          />
          <StatCard
            title="Pending Orders"
            value={(cards?.pending_orders || 0).toLocaleString()}
            icon={<History className="h-5 w-5 text-orange-500" />}
            bgColor="bg-orange-100"
          />
          <StatCard
            title="Cancelled Orders"
            value={(cards?.cancelled_orders || 0).toLocaleString()}
            icon={<X className="h-5 w-5 text-red-500" />}
            bgColor="bg-red-100"
          />
        </div>
      </div>

      {/* --- Chart Section --- */}
      <div>
        <p className="mb-3 text-sm text-gray-500">Income information</p>
        <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <h2 className="text-xl font-bold text-gray-900">Sales Details</h2>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md p-1 border border-gray-100 bg-gray-50">
                  <button
                    onClick={() => {
                      setGranularity("daily")
                      if (granularity === "all_time") {
                        setSelectedMonth(dayjs().month() + 1)
                        setSelectedYear(dayjs().year())
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium transition ${
                      granularity === "daily" 
                        ? "border border-orange-200 bg-orange-50 text-orange-500" 
                        : "text-gray-400 hover:text-gray-600 border border-transparent"
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" /> Daily
                  </button>
                  <button
                    onClick={() => {
                      setGranularity("monthly")
                      if (granularity === "all_time") {
                        setSelectedYear(dayjs().year())
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium transition ${
                      granularity === "monthly" 
                        ? "border border-orange-200 bg-orange-50 text-orange-500" 
                        : "text-gray-400 hover:text-gray-600 border border-transparent"
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" /> Monthly
                  </button>
                </div>

                <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>

                {/* Month Dropdown */}
                <div className="relative">
                   <button 
                    disabled={granularity !== "daily"}
                    onClick={() => setIsMonthOpen(!isMonthOpen)}
                    className={`flex w-28 items-center justify-between rounded-md border px-3 py-1.5 text-sm font-medium outline-none transition ${
                      granularity === "daily" ? "border-gray-300 text-gray-600 hover:border-gray-400 bg-white" : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                    }`}
                   >
                     <span>{granularity === "daily" ? dayjs().month(selectedMonth - 1).format("MMM") : "-"}</span>
                     <span className="text-gray-400 text-xs">▼</span>
                   </button>
                 
                 {isMonthOpen && granularity === "daily" && (
                   <div className="absolute top-10 left-0 z-10 w-48 rounded-md bg-white p-3 shadow-lg border border-gray-100">
                     <div className="grid grid-cols-3 gap-2">
                       {Array.from({length: 12}).map((_, i) => (
                         <button
                           key={i}
                           onClick={() => { setSelectedMonth(i + 1); setIsMonthOpen(false) }}
                           className={`rounded-md py-2 text-sm text-center transition ${
                             selectedMonth === i + 1 
                               ? "bg-orange-500 text-white font-medium shadow-sm" 
                               : "text-gray-600 hover:bg-orange-50 hover:text-orange-500"
                           }`}
                         >
                           {dayjs().month(i).format("MMM")}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              {/* Year Dropdown */}
              <div className="relative">
                 <button 
                  disabled={granularity === "all_time"}
                  onClick={() => setIsYearOpen(!isYearOpen)}
                  className={`flex w-28 items-center justify-between rounded-md border px-3 py-1.5 text-sm font-medium outline-none transition ${
                    granularity !== "all_time" ? "border-gray-300 text-gray-600 hover:border-gray-400 bg-white" : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                  }`}
                 >
                   <span>{granularity !== "all_time" ? selectedYear : "-"}</span>
                   <span className="text-gray-400 text-xs">▼</span>
                 </button>

                 {isYearOpen && granularity !== "all_time" && (
                   <div className="absolute top-10 right-0 z-10 w-48 rounded-md bg-white p-3 shadow-lg border border-gray-100">
                     <div className="grid grid-cols-3 gap-2">
                       {Array.from({length: dayjs().year() - 2020 + 2}).map((_, i) => {
                         const yr = dayjs().year() + 1 - i
                         return (
                           <button
                             key={yr}
                             onClick={() => { setSelectedYear(yr); setIsYearOpen(false); }}
                             className={`rounded-md py-2 text-sm text-center transition ${
                               selectedYear === yr 
                                 ? "bg-orange-500 text-white font-medium shadow-sm" 
                                 : "text-gray-600 hover:bg-orange-50 hover:text-orange-500"
                             }`}
                           >
                             {yr}
                           </button>
                         )
                       })}
                     </div>
                   </div>
                 )}
              </div>

              <button 
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-md bg-[#EF4444] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-600"
              >
                <RefreshCw className="h-4 w-4" /> Reset
              </button>
              </div>
            </div>
          </div>

          <div className="h-80 w-full relative">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>
      </div>

      {/* --- Top Products Table --- */}
      <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-yellow-500" fill="currentColor" />
            <h2 className="text-lg font-bold text-gray-900">Top 5 Best Selling Products</h2>
          </div>
          <div className="flex items-center">
            {/* Mock dropdown to match the design */}
            <button className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-gray-300">
              <span>October</span>
              <span className="text-[10px]">▼</span>
            </button>
          </div>
        </div>
        <p className="mb-6 text-xs text-gray-400">Highest performing products this month</p>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fcfcfc] text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-4 font-bold text-center w-16"></th>
                <th className="p-4 font-bold text-center">Product Name</th>
                <th className="p-4 font-bold text-center">ได้เริด</th>
                <th className="p-4 font-bold text-center">Sold</th>
                <th className="p-4 font-bold text-center">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No products sold in this period
                  </td>
                </tr>
              ) : (
                topProducts.slice(0, 5).map((p, idx) => (
                  <tr key={p.product_id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 flex justify-center">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? "bg-[#FCD34D] text-white" :
                        idx === 1 ? "bg-[#D1D5DB] text-white" :
                        idx === 2 ? "bg-[#FDBA74] text-white" :
                        "bg-[#F3F4F6] text-gray-600"
                      }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {/* Placeholder image cube since we don't have product images in this API */}
                        <div className="h-8 w-8 rounded bg-gray-100 flex-shrink-0"></div>
                        <span className="font-semibold text-gray-700 text-xs sm:text-sm">{p.product_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-gray-400 text-xs">-</span>
                    </td>
                    <td className="p-4 text-center text-gray-600 font-medium text-xs sm:text-sm">{p.total_sold.toLocaleString()}</td>
                    <td className="p-4 text-center font-bold text-gray-800 text-xs sm:text-sm">฿{p.revenue.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, bgColor }: { title: string, value: string | number, icon: React.ReactNode, bgColor: string }) {
  return (
    <div className="flex flex-col p-5 shadow-sm hover:shadow-md transition bg-white border border-gray-100 rounded-2xl w-full">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
