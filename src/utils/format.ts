export function fmtDate(iso: string | null): string {
  if (!iso) return 'never';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}
