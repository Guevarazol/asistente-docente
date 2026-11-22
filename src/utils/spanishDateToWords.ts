const DAYS_ES: Record<number, string> = {
  1: 'un',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
  11: 'once',
  12: 'doce',
  13: 'trece',
  14: 'catorce',
  15: 'quince',
  16: 'dieciséis',
  17: 'diecisiete',
  18: 'dieciocho',
  19: 'diecinueve',
  20: 'veinte',
  21: 'veintiún',
  22: 'veintidós',
  23: 'veintitrés',
  24: 'veinticuatro',
  25: 'veinticinco',
  26: 'veintiséis',
  27: 'veintisiete',
  28: 'veintiocho',
  29: 'veintinueve',
  30: 'treinta',
  31: 'treinta y un',
};

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function numberUnder100ToWords(n: number): string {
  const units = [
    '',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
  ];
  const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  if (n < 30) return units[n] || '';
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? tens[t] : `${tens[t]} y ${units[u]}`;
}

export function yearToSpanishWords(year: number): string {
  if (year < 2000 || year > 2099) {
    return String(year);
  }
  const remainder = year - 2000;
  if (remainder === 0) return 'dos mil';
  return `dos mil ${numberUnder100ToWords(remainder)}`;
}

/**
 * Converts YYYY-MM-DD into formal El Salvador diploma wording:
 * e.g. "2026-11-26" -> "veintiséis días del mes de noviembre de dos mil veintiséis"
 */
export function spanishDateToWords(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '[COMPLETAR FECHA EN LETRAS]';
  }
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const day = Number(dStr);

  const dayWord = DAYS_ES[day] || String(day);
  const dayLabel = day === 1 ? 'día' : 'días';
  const monthWord = MONTHS_ES[monthIdx] || '[MES]';
  const yearWord = yearToSpanishWords(year);

  return `${dayWord} ${dayLabel} del mes de ${monthWord} de ${yearWord}`;
}

/**
 * Converts full names into confidential initials (e.g. "Juan Carlos Pérez López" -> "J. C. P. L.")
 */
export function namesToInitials(rawNames: string): string {
  return rawNames
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((name) => {
      // Preserve parenthetical grade/notes if any
      const words = name.split(/\s+/);
      return words
        .map((w) => (w.length > 0 ? `${w[0].toUpperCase()}.` : ''))
        .join(' ');
    })
    .join(', ');
}

export function formatTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatReadableDateEs(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '[COMPLETAR]';
  const [y, m, d] = isoDate.split('-');
  const monthName = MONTHS_ES[Number(m) - 1] || m;
  return `${Number(d)} de ${monthName} de ${y}`;
}
