// ═══════════════════════════════════════════════════════════════════
// Lumiq — Path Normalization Utilities
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalizes any Windows or Unix file path to standard Unix slash format,
 * handles drive letters consistently, and collapses multiple slashes.
 */
export function normalizePath(p: string): string {
  if (!p) return ''
  let n = p.replace(/\\/g, '/')
  n = n.replace(/\/+/g, '/')
  if (n.match(/^[a-zA-Z]:/)) {
    n = n[0].toLowerCase() + n.slice(1)
    n = n.replace(/^([a-zA-Z]:)\/*/, '$1/')
  }
  return n
}
