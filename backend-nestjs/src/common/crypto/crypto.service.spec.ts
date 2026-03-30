import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService();
  });

  describe('encrypt / decrypt round-trip', () => {
    it('should encrypt and decrypt correctly', () => {
      const key = 'test-encryption-key-32-bytes!!xx'; // 32 bytes
      const plaintext = Buffer.from('Hello, secret world!');

      const encrypted = service.encrypt(plaintext, key);

      // Encrypted should differ from plaintext
      expect(encrypted.toString()).not.toEqual(plaintext.toString());

      // Encrypted format: 12-byte nonce + ciphertext + 16-byte tag
      // Minimum size = 12 + 0 + 16 = 28, but with data it should be more
      expect(encrypted.length).toBeGreaterThanOrEqual(28);

      const decrypted = service.decrypt(encrypted, key);
      expect(decrypted.toString('utf8')).toEqual('Hello, secret world!');
    });

    it('should produce different ciphertext each time (random nonce)', () => {
      const key = '12345678901234567890123456789012';
      const plaintext = Buffer.from('same data');

      const enc1 = service.encrypt(plaintext, key);
      const enc2 = service.encrypt(plaintext, key);

      // Different nonces → different ciphertexts
      expect(enc1.equals(enc2)).toBe(false);

      // But both decrypt to the same value
      expect(service.decrypt(enc1, key).toString()).toEqual('same data');
      expect(service.decrypt(enc2, key).toString()).toEqual('same data');
    });
  });

  describe('encryptToBase64 / decryptFromBase64', () => {
    it('should round-trip through base64 encoding', () => {
      const key = '12345678901234567890123456789012';
      const plaintext = 'API key: sk-ant-abc123';

      const encoded = service.encryptToBase64(plaintext, key);

      // Should be a valid base64 string
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = service.decryptFromBase64(encoded, key);
      expect(decoded).toEqual(plaintext);
    });
  });

  describe('decrypt with wrong key', () => {
    it('should fail to decrypt with a different key', () => {
      const key1 = '12345678901234567890123456789012';
      const key2 = 'abcdefghijklmnopqrstuvwxyz123456';

      const encrypted = service.encrypt(Buffer.from('secret data'), key1);

      expect(() => service.decrypt(encrypted, key2)).toThrow();
    });
  });

  describe('key validation', () => {
    it('should reject keys that are not 32 bytes', () => {
      expect(() =>
        service.encrypt(Buffer.from('test'), 'short-key'),
      ).toThrow('Encryption key must be exactly 32 bytes');

      expect(() =>
        service.decrypt(Buffer.alloc(30), 'short-key'),
      ).toThrow('Encryption key must be exactly 32 bytes');
    });
  });

  describe('ciphertext too short', () => {
    it('should fail on ciphertext shorter than nonce + tag', () => {
      const key = '12345678901234567890123456789012';
      expect(() =>
        service.decrypt(Buffer.alloc(10), key),
      ).toThrow('Ciphertext too short');
    });
  });

  describe('binary format compatibility', () => {
    it('should produce: [12-byte nonce][ciphertext][16-byte tag]', () => {
      const key = '12345678901234567890123456789012';
      const plaintext = Buffer.from('test data here');

      const encrypted = service.encrypt(plaintext, key);

      // Total length = 12 (nonce) + plaintext.length (ciphertext) + 16 (tag)
      expect(encrypted.length).toBe(12 + plaintext.length + 16);
    });
  });

  describe('generateRandomString', () => {
    it('should generate different strings each time', () => {
      const s1 = service.generateRandomString(32);
      const s2 = service.generateRandomString(32);
      expect(s1).not.toEqual(s2);
      expect(typeof s1).toBe('string');
      expect(s1.length).toBeGreaterThan(0);
    });
  });
});
