/**
 * Returns the start of today in Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7).
 */
export function todayStartVN(): Date {
  const now = new Date();
  // Format as date string in VN timezone, then parse back as UTC
  const vnDateStr = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }); // YYYY-MM-DD
  // Create a date at midnight VN time = that date minus 7 hours in UTC
  const vnMidnight = new Date(vnDateStr + 'T00:00:00+07:00');
  return vnMidnight;
}

/**
 * Returns the start of the current month in Vietnam timezone.
 */
export function monthStartVN(): Date {
  const now = new Date();
  const vnDateStr = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const [year, month] = vnDateStr.split('-');
  return new Date(`${year}-${month}-01T00:00:00+07:00`);
}
