/** Vietnam timezone identifier (UTC+7). */
export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Convert a Date to a string representation in Vietnam timezone. */
export function toVN(date: Date): string {
  return date.toLocaleString('en-US', { timeZone: VN_TIMEZONE });
}
