/** Strips hyphens/spaces and returns the normalized ISBN, or null if invalid (format or checksum). */
export function normalizeIsbn(input: string): string | null {
  const s = input.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const c = s[i] as string;
      sum += (c === "X" ? 10 : Number(c)) * (10 - i);
    }
    return sum % 11 === 0 ? s : null;
  }
  if (/^(978|979)\d{10}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0 ? s : null;
  }
  return null;
}
