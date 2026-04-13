/**
 * Convert a Date to Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7).
 */
export function toVN(date: Date): Date {
  const vnOffset = 7 * 60; // UTC+7 in minutes
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000;
  return new Date(utc + vnOffset * 60_000);
}
