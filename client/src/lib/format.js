// Shared display formatters so every screen renders money/dates/numbers the same.

export const rs = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });

export const num = (n) => Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });

// Stored dates are messy (M/D/YYYY, ISO, etc.). Prefer the normalized *ISO
// column when present, otherwise show the raw value as-is.
export function fmtDate(value) {
  if (!value) return '—';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    if (!isNaN(d)) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return s;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toLocaleString();
}

// Convert any stored date into the yyyy-mm-dd a <input type="date"> expects.
export function toDateInput(value) {
  if (!value) return '';
  const s = String(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}
