/**
 * Safely parses the opening hours dictionary and returns the current day's hours.
 * @param openingHours The record of opening hours mapping day to hour string.
 * @returns The formatted string for today, e.g., "08:00 - 20:00" or "Closed"
 */
export function getTodayOpeningHours(openingHours?: Record<string, string>): string {
  if (!openingHours) return 'Hours unavailable';

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  
  const todayHours = openingHours[today];
  if (!todayHours || todayHours.toLowerCase() === 'closed') {
    return 'Closed Today';
  }
  
  return todayHours;
}
