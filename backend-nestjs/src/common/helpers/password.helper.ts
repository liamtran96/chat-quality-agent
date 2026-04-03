/**
 * Validates password complexity matching the Go backend rules:
 * - min 8 chars
 * - at least 1 uppercase letter
 * - at least 1 digit
 */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 8) {
    return 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 8 k\u00FD t\u1EF1';
  }
  if (!/[A-Z]/.test(password)) {
    return 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 1 ch\u1EEF hoa';
  }
  if (!/[0-9]/.test(password)) {
    return 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 1 ch\u1EEF s\u1ED1';
  }
  return null;
}
