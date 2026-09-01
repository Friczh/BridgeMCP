// A bare date (YYYY-MM-DD, length 10) has no time component. Left as-is,
// Postgres reads it as 00:00:00Z — correct as a lower bound, but wrong as an
// upper bound (it would exclude the entire day it names). Bump date_to to
// the last instant of that day so "date_to=2026-08-25" includes 08-25 fully.
// Anything already carrying a time component (full ISO datetime) is passed
// through untouched.

export function normalizeDateFrom(value: string): string {
  return value;
}

export function normalizeDateTo(value: string): string {
  if (value.length === 10) return `${value}T23:59:59.999Z`;
  return value;
}
