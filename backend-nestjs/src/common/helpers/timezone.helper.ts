const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Converts a Date to a Vietnam timezone (UTC+7) ISO string with +07:00 offset.
 * Example output: "2024-01-15T14:30:00+07:00"
 */
export function toVN(date: Date): string {
  return date.toLocaleString('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(' ', 'T') + '+07:00';
}

/**
 * Formats a Date as HH:mm in VN timezone.
 */
export function toVNTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a Date as dd/MM/yyyy HH:mm in VN timezone.
 */
export function toVNDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a Date as dd/MM/yyyy in VN timezone.
 */
export function toVNDate(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formats a Date as ISO string without timezone (UTC format used by Go backend).
 * Example: "2024-01-15T14:30:00Z"
 */
export function toUTCString(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export { VN_TIMEZONE };
