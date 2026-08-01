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
  // Normalize Windows drive letter to lowercase
  if (n.match(/^[a-zA-Z]:/)) {
    n = n.charAt(0).toLowerCase() + n.slice(1)
  }
  return n
}
