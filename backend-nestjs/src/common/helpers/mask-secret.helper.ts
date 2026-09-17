/**
 * Masks a secret string, showing only the last 4 characters.
 * e.g. "sk-ant-abc123xyz" -> "****3xyz"
 */
export function maskSecret(s: string): string {
  if (s.length <= 4) {
    return '****';
  }
  const visible = s.slice(-4);
  return '****' + visible;
}
