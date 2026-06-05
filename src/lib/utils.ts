export function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0] ?? '').filter(Boolean).join('').slice(0, 2).toUpperCase();
}
