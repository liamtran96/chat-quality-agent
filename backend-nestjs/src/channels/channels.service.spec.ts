import { createAdapter } from './adapters/adapter.factory';
import { ZaloOAAdapter } from './adapters/zalo-oa.adapter';
import { FacebookAdapter } from './adapters/facebook.adapter';
import { CryptoService } from '../common/crypto/crypto.service';
import { ConfigService } from '@nestjs/config';

describe('Adapter Factory', () => {
  it('should create ZaloOA adapter with valid credentials', () => {
    const creds = JSON.stringify({
      app_id: '123',
      app_secret: 'abc',
      access_token: 'tok',
      refresh_token: 'ref',
    });
    const adapter = createAdapter('zalo_oa', creds);
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(ZaloOAAdapter);
  });

  it('should create Facebook adapter with valid credentials', () => {
    const creds = JSON.stringify({
      page_id: '123',
      access_token: 'tok',
    });
    const adapter = createAdapter('facebook', creds);
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(FacebookAdapter);
  });

  it('should throw for unsupported channel type', () => {
    expect(() => createAdapter('whatsapp', '{}')).toThrow(
      'unsupported channel type: whatsapp',
    );
  });

  it('should throw for invalid JSON (zalo_oa)', () => {
    expect(() => createAdapter('zalo_oa', 'not json')).toThrow(
      'invalid zalo_oa credentials',
    );
  });

  it('should throw for invalid JSON (facebook)', () => {
    expect(() => createAdapter('facebook', 'not json')).toThrow(
      'invalid facebook credentials',
    );
  });
});

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    const configService = {
      get: (key: string, defaultVal?: string) => {
        if (key === 'encryptionKey') return '01234567890123456789012345678901';
        return defaultVal ?? '';
      },
    } as ConfigService;
    cryptoService = new CryptoService(configService);
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = Buffer.from('hello world credentials');
    const encrypted = cryptoService.encrypt(plaintext);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted.toString('utf-8')).toBe('hello world credentials');
  });

  it('should produce different ciphertexts for same plaintext (random nonce)', () => {
    const plaintext = Buffer.from('same text');
    const enc1 = cryptoService.encrypt(plaintext);
    const enc2 = cryptoService.encrypt(plaintext);
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('should throw on short ciphertext', () => {
    expect(() => cryptoService.decrypt(Buffer.from('short'))).toThrow(
      'ciphertext too short',
    );
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = cryptoService.encrypt(Buffer.from('test'));
    // Tamper with the ciphertext
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => cryptoService.decrypt(encrypted)).toThrow();
  });

  it('should encrypt/decrypt base64 round-trip', () => {
    const plaintext = Buffer.from('{"key": "secret"}');
    const encoded = cryptoService.encryptToBase64(plaintext);
    expect(typeof encoded).toBe('string');

    const decrypted = cryptoService.decryptFromBase64(encoded);
    expect(decrypted.toString('utf-8')).toBe('{"key": "secret"}');
  });

  it('should generate random strings', () => {
    const s1 = cryptoService.generateRandomString(32);
    const s2 = cryptoService.generateRandomString(32);
    expect(s1).not.toBe(s2);
    expect(s1.length).toBeGreaterThan(0);
  });
});

describe('CryptoService validation', () => {
  it('should throw if encryption key is not 32 bytes', () => {
    const configService = {
      get: (key: string, defaultVal?: string) => {
        if (key === 'encryptionKey') return 'too-short';
        return defaultVal ?? '';
      },
    } as ConfigService;
    expect(() => new CryptoService(configService)).toThrow(
      'ENCRYPTION_KEY must be exactly 32 bytes',
    );
  });
});
