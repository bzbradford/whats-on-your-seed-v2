// Small formatting helpers ported from the legacy script (legacy/static/index.html).

/** Lowercase, trim and collapse whitespace. Matches legacy `norm`. */
export function norm(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Today's date (YYYY-MM-DD) in America/Chicago, the catalog's reference time zone. */
export function localDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * "Sep 21, 2026" from a date or ISO timestamp, using only its calendar date
 * (so a UTC timestamp never shifts a day). Missing values read "Not supplied".
 */
export function fmt(d: string | null | undefined): string {
  return d
    ? new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Not supplied';
}

/** "Corn (seed treatment)" -> "Corn". */
export function shortSite(site: string): string {
  return site.replace(/ \(seed treatment\)/gi, '');
}

/** Only https URLs are linked; anything else becomes '#'. */
export function safeUrl(url: unknown): string {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' ? u.href : '#';
  } catch {
    return '#';
  }
}

/** Plural suffix helper: `${n} product${s(n)}`. */
export function s(n: number): string {
  return n === 1 ? '' : 's';
}

/** "1 product", "2 products"; pass the plural for irregular words ("1 match", "2 matches"). */
export function count(n: number, word: string, plural = word + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? word : plural}`;
}
