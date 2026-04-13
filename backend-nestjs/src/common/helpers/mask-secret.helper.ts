/**
 * Mask a secret string, showing only last 4 chars.
 * e.g. "sk-ant-abc123xyz" -> "****3xyz"
 */
export function maskSecret(s: string): string {
  if (s.length <= 4) {
    return '****';
  }
  const visible = s.slice(-4);
  return '****' + visible;
}
