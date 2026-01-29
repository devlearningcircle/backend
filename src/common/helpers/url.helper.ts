/**
 * URL Helper
 *
 * Provides utility functions for generating full URLs for uploaded files.
 * This ensures that the frontend always receives complete URLs instead of relative paths.
 */

/**
 * Get the base URL for the application
 * Uses environment variable or falls back to production URL
 */
export function getBaseUrl(): string {
  return process.env.APP_BASE_URL || 'https://dev.learningcircle.education/schoolcrmbackend';
}

/**
 * Convert a relative file path to a full URL
 * @param relativePath - The relative path (e.g., '/uploads/students/file.jpg')
 * @returns Full URL or null if path is empty
 */
export function toFullUrl(relativePath?: string): string | undefined {
  if (!relativePath) return undefined;

  // If it's already a full URL, return as-is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  const baseUrl = getBaseUrl();
  // Ensure no double slashes
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Convert multiple relative paths to full URLs
 * @param paths - Object with relative paths
 * @returns Object with full URLs
 */
export function toFullUrls<T extends Record<string, string | undefined>>(
  paths: T
): T {
  const result = {} as T;

  for (const [key, value] of Object.entries(paths)) {
    (result as any)[key] = toFullUrl(value);
  }

  return result;
}
