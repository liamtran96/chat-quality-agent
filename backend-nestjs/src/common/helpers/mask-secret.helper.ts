/**
 * Mask a secret string, showing only last 4 characters.
 * e.g. "sk-ant-abc123xyz" -> "****3xyz"
 */
export function maskSecret(s: string): string {
  if (s.length <= 4) {
    return '****';
  }
  return '****' + s.slice(-4);
}
