/** Local date as YYYY-MM-DD */
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** "Monday 21 July" style header date */
export function todayLabel(): string {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function greetingForNow(name?: string): string {
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return name ? `Good ${timeOfDay}, ${name}` : `Good ${timeOfDay}`
}

/** "09:00" → "9am", "13:30" → "1:30pm" */
export function formatHourLabel(time: string): string {
  const [hourRaw, minuteRaw] = time.split(':')
  const hour = Number(hourRaw)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return minuteRaw === '00' || minuteRaw === undefined
    ? `${displayHour}${suffix}`
    : `${displayHour}:${minuteRaw}${suffix}`
}

export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}${suffix}`
}

/** Shifts an HH:mm time by `deltaMinutes`, wrapping around midnight. */
export function shiftTime(time: string, deltaMinutes: number): string {
  const [hour, minute] = time.split(':').map(Number)
  const dayMinutes = 24 * 60
  const total = ((hour * 60 + minute + deltaMinutes) % dayMinutes + dayMinutes) % dayMinutes
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
