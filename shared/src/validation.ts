export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function cleanName(s: string): string | null {
  const t = s.trim();
  return /^[A-Za-z0-9 _.-]{1,16}$/.test(t) ? t : null;
}
