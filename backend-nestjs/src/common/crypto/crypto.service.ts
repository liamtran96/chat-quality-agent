import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * CryptoService provides AES-256-GCM encryption/decryption matching the Go backend format.
 *
 * Go format: nonce (12 bytes) || ciphertext || authTag (16 bytes)
 * The Go implementation uses gcm.Seal(nonce, nonce, plaintext, nil) which prepends
 * the nonce to the combined ciphertext+tag output.
 */
@Injectable()
export class CryptoService {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey =
      configService.get<string>('ENCRYPTION_KEY') ?? '';
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns Buffer: nonce (12 bytes) || ciphertext || authTag (16 bytes)
   */
  encrypt(plaintext: Buffer, key?: string): Buffer {
    const keyStr = key ?? this.encryptionKey;
    const keyBuf = Buffer.from(keyStr, 'utf-8');
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, nonce);
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Go format: nonce + ciphertext + authTag
    return Buffer.concat([nonce, encrypted, authTag]);
  }

  /**
   * Decrypt AES-256-GCM ciphertext (nonce prepended, matching Go format).
   * Input Buffer: nonce (12 bytes) || ciphertext || authTag (16 bytes)
   */
  decrypt(data: Buffer, key?: string): Buffer {
    const keyStr = key ?? this.encryptionKey;
    const keyBuf = Buffer.from(keyStr, 'utf-8');
    const nonceSize = 12;
    const tagSize = 16;

    if (data.length < nonceSize + tagSize) {
      throw new Error('ciphertext too short');
    }

    const nonce = data.subarray(0, nonceSize);
    const authTag = data.subarray(data.length - tagSize);
    const ciphertext = data.subarray(nonceSize, data.length - tagSize);

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Encrypt and return base64-encoded string.
   */
  encryptToBase64(plaintext: Buffer, key?: string): string {
    const encrypted = this.encrypt(plaintext, key);
    return encrypted.toString('base64');
  }

  /**
   * Decode base64 and decrypt.
   */
  decryptFromBase64(encoded: string, key?: string): Buffer {
    const data = Buffer.from(encoded, 'base64');
    return this.decrypt(data, key);
  }
}
