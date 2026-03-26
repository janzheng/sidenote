/**
 * Shared utilities for social media extraction services (Twitter + LinkedIn)
 */

/**
 * Format engagement numbers with K/M notation
 */
export function formatEngagement(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
