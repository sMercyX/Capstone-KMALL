import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import type { orderSellerData } from "../../api/orderSellerApi"

interface StatusBannerProps {
  order: orderSellerData
  isSeller: boolean
}

export default function StatusBanner({ order, isSeller }: StatusBannerProps) {
  const status = order.status
  const isFinished = status === "Completed" || status === "Cancelled"

  let message = ""
  let bgColor = "bg-blue-50"
  let textColor = "text-blue-700"
  let borderColor = "border-blue-100"
  
  // Icon logic: Spinning for active, static for finished
  const Icon = status === "Completed" ? CheckCircle2 : status === "Cancelled" ? XCircle : Loader2

  if (isSeller) {
    switch (status) {
      case "Pending":
        message = "You have a new order. Please review the items and propose a meeting time/location to start."
        bgColor = "bg-orange-50"
        textColor = "text-orange-700"
        borderColor = "border-orange-100"
        break
      case "Proposed":
        message = "Proposal sent. Waiting for the buyer to review and accept your meeting details."
        break
      case "Accepted":
        message = "Order confirmed. Please prepare the items and mark as 'Out for Delivery' once you start moving."
        break
      case "Out For Delivery":
        message = "You are currently delivering. Mark the order as 'Arrived' once you reach the meeting point or destination."
        break
      case "Arrived":
        message = "You've arrived! Hand over the items and mark the order as 'Completed' to finalize the sale."
        break
      case "Completed":
        message = "Order completed successfully. Great job!"
        bgColor = "bg-green-50"
        textColor = "text-green-700"
        borderColor = "border-green-100"
        break
      case "Cancelled":
        message = "This order has been cancelled and finalized."
        bgColor = "bg-red-50"
        textColor = "text-red-700"
        borderColor = "border-red-100"
        break
    }
  } else {
    switch (status) {
      case "Pending":
        message = "Your order is placed! We're waiting for the seller to confirm and propose meeting details."
        break
      case "Proposed":
        message = "The seller has proposed meeting details. Please review and accept them to move forward."
        bgColor = "bg-orange-50"
        textColor = "text-orange-700"
        borderColor = "border-orange-100"
        break
      case "Accepted":
        message = "The seller has accepted! They are now preparing your items. You'll be notified when they start delivery."
        break
      case "Out For Delivery":
        message = "The seller is on the way! Please be ready to meet them at the meeting point or your address."
        break
      case "Arrived":
        message = "The seller has arrived at the location! Please meet them to receive your items."
        bgColor = "bg-green-50"
        textColor = "text-green-700"
        borderColor = "border-green-100"
        break
      case "Completed":
        message = "Order completed successfully. We hope you enjoy your purchase!"
        bgColor = "bg-green-50"
        textColor = "text-green-700"
        borderColor = "border-green-100"
        break
      case "Cancelled":
        message = "This order has been cancelled."
        bgColor = "bg-red-50"
        textColor = "text-red-700"
        borderColor = "border-red-100"
        break
    }
  }

  if (!message) return null

  return (
    <div className={`mb-6 p-4 rounded-2xl border ${borderColor} ${bgColor} flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500`}>
      <div className={`p-2.5 rounded-xl bg-white shadow-sm flex-shrink-0 flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${textColor} ${!isFinished ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 pt-0.5">
        <p className={`text-text font-bold ${textColor} mb-0.5 uppercase tracking-wider`}>Status Update</p>
        <p className={`text-description font-semibold ${textColor} opacity-90 leading-relaxed`}>
          {message}
        </p>
      </div>
    </div>
  )
}
