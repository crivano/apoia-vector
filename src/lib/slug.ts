/**
 * Generate a URL-friendly slug from a string
 * - Converts to lowercase
 * - Removes diacritics (accents)
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * 
 * @param text - The text to convert to a slug
 * @returns A lowercase slug with hyphens
 * 
 * @example
 * generateSlug("Blog Posts") // "blog-posts"
 * generateSlug("API Data (2025)") // "api-data-2025"
 * generateSlug("São Paulo - Brasil") // "sao-paulo-brasil"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD") // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics (accents)
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with single hyphen
    .replace(/-+/g, "-"); // Replace consecutive hyphens with single hyphen
}

/**
 * Validate if a string is a valid slug format
 * Must be lowercase alphanumeric with hyphens only
 * 
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
