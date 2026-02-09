import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

export const formatDate = (dateString: string, formatStr: string = 'dd MMM yyyy HH:mm') => {
  if (!dateString) return ''
  try {
    return format(parseISO(dateString), formatStr, { locale: th })
  } catch (error) {
    console.error('Invalid date string:', dateString)
    return dateString
  }
}

export const formatThaiDate = (dateString: string) => {
  if (!dateString) return ''
  try {
    const date = parseISO(dateString)
    const dayMonth = format(date, 'd MMMM', { locale: th })
    const year = date.getFullYear() + 543
    return `${dayMonth} ${year}`
  } catch (error) {
    console.error('Invalid date string:', dateString)
    return dateString
  }
}
