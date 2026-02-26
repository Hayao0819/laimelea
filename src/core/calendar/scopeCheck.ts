const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar",
];

export function hasCalendarScope(grantedScopes: string[]): boolean {
  return grantedScopes.some((s) => CALENDAR_SCOPES.includes(s));
}
