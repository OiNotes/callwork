/**
 * Escapes values to protect against CSV formula injection.
 * Values beginning with =, +, -, @, tab, or CR can be treated as formulas in Excel.
 */
export function sanitizeForCsv(value: unknown): string {
  if (value === null || value === undefined) return ''

  const str = String(value)

  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }

  return str
}

/**
 * Sanitizes all values in an object for CSV export.
 */
export function sanitizeRowForExport<T extends Record<string, unknown>>(row: T): T {
  const sanitized = {} as T
  for (const [key, value] of Object.entries(row)) {
    sanitized[key as keyof T] = sanitizeForCsv(value) as T[keyof T]
  }
  return sanitized
}
