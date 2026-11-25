const BLOCKED_EXACT = new Set([
  'god',
  'allah',
  'alloh',
  'jesus',
  'jesuschrist',
  'christ',
  'yahweh',
  'jehovah',
  'yhwh',
  'elohim',
  'adonai',
  'almighty',
  'holyspirit',
  'messiah',
  'rasulullah',
  'prophet',
  'buddha',
  'krishna',
  'shiva',
  'vishnu',
  'brahma',
  'ganesha',
  'satan',
  'lucifer',
  'devil',
  'shaitan',
  'shaytan',
  'iblis',
  'bog',
  'gospod',
  'iisus',
  'khristos',
  'hristos',
  'xudo',
  'khudo',
  'hudo',
  'quday',
  'kuday',
  'tengri',
  'tangri',
]);

function normalizeLeet(token: string, oneAs: 'i' | 'l'): string {
  return token
    .replace(/0/g, 'o')
    .replace(/1/g, oneAs)
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

function matchesBlockedToken(raw: string): boolean {
  const clean = raw.replace(/^_+|_+$/g, '');
  if (!clean) return false;
  if (BLOCKED_EXACT.has(clean)) return true;

  const noTrailingDigits = clean.replace(/[0-9]+$/g, '');
  if (noTrailingDigits && BLOCKED_EXACT.has(noTrailingDigits)) return true;

  const noOuterDigits = clean.replace(/^[0-9]+|[0-9]+$/g, '');
  if (noOuterDigits && BLOCKED_EXACT.has(noOuterDigits)) return true;

  if (BLOCKED_EXACT.has(normalizeLeet(clean, 'l'))) return true;
  if (BLOCKED_EXACT.has(normalizeLeet(clean, 'i'))) return true;

  const collapsedTwo = clean.replace(/([a-z])\1{2,}/g, '$1$1');
  if (BLOCKED_EXACT.has(collapsedTwo)) return true;
  const collapsedOne = clean.replace(/([a-z])\1{2,}/g, '$1');
  if (BLOCKED_EXACT.has(collapsedOne)) return true;

  return false;
}

export function isBlockedUsername(username: string): boolean {
  const lower = String(username || '').trim().toLowerCase();
  if (!lower) return false;

  if (matchesBlockedToken(lower)) return true;

  const compact = lower.replace(/_/g, '');
  if (matchesBlockedToken(compact)) return true;

  const parts = lower.split('_').filter(Boolean);
  for (const part of parts) {
    if (matchesBlockedToken(part)) return true;
  }

  return false;
}
