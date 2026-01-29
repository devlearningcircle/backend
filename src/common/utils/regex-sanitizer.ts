/**
 * Escapes special regex characters to prevent NoSQL injection attacks
 * @param str - The string to escape
 * @returns Escaped string safe for use in regex patterns
 */
export function escapeRegex(str: string): string {
  if (!str || typeof str !== 'string') return '';
  // Escape all special regex characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates and formats YYYY-MM date strings
 * @param month - The month string to validate (format: YYYY-MM)
 * @returns Validated month string or throws error
 */
export function validateMonth(month: string): string {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthRegex.test(month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }
  return month;
}
