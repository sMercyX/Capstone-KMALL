// src/components/Dropdown/DateTimePicker.tsx
import { useState } from "react"

interface DateTimePickerProps {
  value: Date | null
  onChange: (date: Date | null, time: string) => void
  disabled?: boolean
  placeholder?: string
  label?: string
  timeSlots?: string[]
  defaultTime?: string
}

const DEFAULT_TIME_SLOTS = [
  "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM",
  "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM"
]

export default function DateTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "เลือกวันและเวลา",
  label = "วันและเวลา",
  timeSlots = DEFAULT_TIME_SLOTS,
  defaultTime = "10:00 AM"
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(value || new Date())
  const [tempDate, setTempDate] = useState<Date | null>(value)
  const [selectedTime, setSelectedTime] = useState(defaultTime)

  // Format display text
  const formatDisplayText = () => {
    if (!value) return placeholder
    return `${selectedTime} ${value.toLocaleDateString('en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    })}`
  }

  // Generate calendar days
  function generateCalendarDays(month: Date) {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    
    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, monthIndex, -i)
      days.push({ date, isCurrentMonth: false })
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, monthIndex, i), isCurrentMonth: true })
    }
    
    // Next month days to fill grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, monthIndex + 1, i), isCurrentMonth: false })
    }
    
    return days
  }

  const handleConfirm = () => {
    onChange(tempDate, selectedTime)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempDate(value)
    setIsOpen(false)
  }

  return (
    <div>
      {label && (
        <label className="block text-base font-semibold mb-3">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between text-left
            ${isOpen ? 'border-orange-500' : ''}
            ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-gray-300 cursor-pointer'}`}
        >
          <span className="text-base font-medium text-gray-700">
            {formatDisplayText()}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && !disabled && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg p-4">
            <div className="flex gap-4">
              {/* Calendar */}
              <div className="flex-1">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const newDate = new Date(calendarMonth)
                      newDate.setMonth(newDate.getMonth() - 1)
                      setCalendarMonth(newDate)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ←
                  </button>
                  <span className="font-medium">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newDate = new Date(calendarMonth)
                      newDate.setMonth(newDate.getMonth() + 1)
                      setCalendarMonth(newDate)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    →
                  </button>
                </div>
                
                {/* Day Headers */}
                <div className="grid grid-cols-7 text-center text-sm text-gray-500 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>
                
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays(calendarMonth).map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => day.isCurrentMonth && setTempDate(day.date)}
                      disabled={!day.isCurrentMonth}
                      className={`p-2 text-sm rounded-full transition-colors
                        ${!day.isCurrentMonth ? 'text-gray-300' : 'hover:bg-gray-100'}
                        ${tempDate && day.date.toDateString() === tempDate.toDateString() 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : ''}`}
                    >
                      {day.date.getDate()}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Time Selection */}
              <div className="w-28 max-h-60 overflow-auto border-l pl-4">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                      ${selectedTime === time 
                        ? 'bg-orange-500 text-white' 
                        : 'hover:bg-gray-100'}`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                ตกลง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

