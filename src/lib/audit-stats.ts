export interface DailyStat {
  date: string; // YYYY-MM-DD, UTC
  ok_count: number;
  error_count: number;
}

interface AuditRow {
  called_at: string;
  success: boolean;
}

function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// Returns the UTC midnight timestamp `days` calendar days ago (inclusive of
// today), used as the lower bound for the DB query.
export function rangeStartIso(days: number): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString();
}

// Buckets rows by date(called_at) and success, zero-filled across every day
// in [today - (days-1), today] even if a day has no rows at all.
export function bucketByDay(rows: AuditRow[], days: number): DailyStat[] {
  const counts = new Map<string, { ok: number; error: number }>();

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    counts.set(utcDateKey(d.toISOString()), { ok: 0, error: 0 });
  }

  for (const row of rows) {
    const key = utcDateKey(row.called_at);
    const bucket = counts.get(key);
    if (!bucket) continue; // outside the requested range (shouldn't happen given the query's lower bound)
    if (row.success) bucket.ok += 1;
    else bucket.error += 1;
  }

  return [...counts.entries()].map(([date, { ok, error }]) => ({
    date,
    ok_count: ok,
    error_count: error,
  }));
}
