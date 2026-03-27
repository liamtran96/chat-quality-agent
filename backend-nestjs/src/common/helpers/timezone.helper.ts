/**
 * Vietnam timezone identifier (Asia/Ho_Chi_Minh, UTC+7).
 */
export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Convert a Date to Vietnam timezone string representation.
 * Returns a new Date object adjusted to VN time for display purposes.
 */
export function toVN(date: Date): Date {
  const vnString = date.toLocaleString('en-US', { timeZone: VN_TIMEZONE });
  return new Date(vnString);
}
