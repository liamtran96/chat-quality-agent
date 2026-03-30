/** Vietnam timezone identifier (UTC+7). */
export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Format a Date to Vietnam timezone date-time: YYYY-MM-DD HH:mm */
export function formatVNDateTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
