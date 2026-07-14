import { format } from 'date-fns'

export const formatNightDate = (date) => {
  return format(new Date(date), 'MMM d, yyyy')
}

export const isPostUnlocked = (closedAt) => {
  if (!closedAt) return false
  const unlockTime = new Date(closedAt)
  unlockTime.setHours(11, 0, 0, 0)
  unlockTime.setDate(unlockTime.getDate() + 1)
  return new Date() >= unlockTime
}

export const canAddToEvent = (event) => {
  return event.status === 'active'
}

export const getInitials = (name) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}