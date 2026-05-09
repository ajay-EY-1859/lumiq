// ═══════════════════════════════════════════════════════════════════
// Lumiq — Formatters
// ═══════════════════════════════════════════════════════════════════

/**
 * Formats a token count for display (e.g., 1234 → "1,234")
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString()
}

/**
 * Formats a date string into a relative or absolute display.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

/**
 * Groups sessions by date category (Today, Yesterday, Last Week, Older).
 */
export function groupByDate<T extends { updatedAt?: string; createdAt?: string }>(
  items: T[]
): { label: string; items: T[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const lastWeek = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: T[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Older', items: [] }
  ]

  for (const item of items) {
    const dateStr = item.updatedAt || item.createdAt || ''
    const date = new Date(dateStr)

    if (date >= today) {
      groups[0].items.push(item)
    } else if (date >= yesterday) {
      groups[1].items.push(item)
    } else if (date >= lastWeek) {
      groups[2].items.push(item)
    } else {
      groups[3].items.push(item)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}

/**
 * Truncates text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
