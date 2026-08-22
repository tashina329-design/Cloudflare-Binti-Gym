/**
 * Brunei Darussalam Timezone (Asia/Brunei, UTC+8) Utility
 * Guarantees all dates and timestamps automatically reflect Brunei local time.
 */

export const BRUNEI_TIMEZONE = 'Asia/Brunei';

/**
 * Returns today's ISO date string (YYYY-MM-DD) in Brunei Time.
 */
export function getBruneiTodayIsoDate(dateObj?: Date): string {
  const d = dateObj || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRUNEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Returns current formatted time string in 12-hour format with AM/PM in Brunei Time.
 * e.g. "09:30 AM" or "02:15 PM"
 */
export function getBruneiFormattedTime(dateObj?: Date, includeSeconds = false): string {
  const d = dateObj || new Date();
  return d.toLocaleTimeString('en-US', {
    timeZone: BRUNEI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

/**
 * Returns formatted long date string (e.g. "Monday, Aug 10, 2026") in Brunei Time.
 */
export function getBruneiFormattedDate(dateObj?: Date): string {
  const d = dateObj || new Date();
  return d.toLocaleDateString('en-US', {
    timeZone: BRUNEI_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculates a date offset by months/days starting from a base date in Brunei Time.
 * Returns ISO date string (YYYY-MM-DD).
 */
export function getBruneiFutureIsoDate(monthsAhead = 1, daysAhead = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  d.setDate(d.getDate() + daysAhead);
  return getBruneiTodayIsoDate(d);
}
