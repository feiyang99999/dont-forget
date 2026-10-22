/** Same-origin path. Production base is relative so a GitHub Pages subpath still works. */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}${path.replace(/^\//, '')}`;
}
