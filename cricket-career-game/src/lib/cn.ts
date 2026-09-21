/** Join class names, dropping anything falsy. Keeps JSX readable. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
