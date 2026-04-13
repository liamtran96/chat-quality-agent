/** Vietnam timezone identifier (Asia/Ho_Chi_Minh, UTC+7). */
export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Convert a Date to a string formatted in Vietnam timezone. */
export function toVN(date: Date): Date {
  // Create a new Date object representing the same instant but
  // when converted to string, will show Vietnam time.
  const vnString = date.toLocaleString('en-US', { timeZone: VN_TIMEZONE });
  return new Date(vnString);
}
