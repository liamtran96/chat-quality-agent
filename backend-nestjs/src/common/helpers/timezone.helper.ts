/**
 * Convert a Date to Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7).
 * Returns a new Date object adjusted for display purposes.
 */
export function toVN(date: Date): Date {
  // Create a date string in VN timezone
  const vnString = date.toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return new Date(vnString);
}

/**
 * Format a Date to HH:mm in Vietnam timezone.
 */
export function formatTimeVN(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
