import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * CryptoService implements AES-256-GCM encryption/decryption matching the Go backend format.
 *
 * Format: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 * The nonce is prepended to the ciphertext, matching Go's gcm.Seal(nonce, nonce, plaintext, nil).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyStr = this.configService.get<string>('encryptionKey', '');
    if (keyStr.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 bytes for AES-256-GCM');
    }
    this.key = Buffer.from(keyStr, 'utf-8');
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns Buffer with nonce prepended (matches Go's format).
   */
  encrypt(plaintext: Buffer): Buffer {
    const nonce = crypto.randomBytes(12); // GCM standard nonce size
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Go's gcm.Seal returns: nonce + ciphertext + authTag
    return Buffer.concat([nonce, encrypted, authTag]);
  }

  /**
   * Decrypt AES-256-GCM ciphertext with nonce prepended (matches Go's format).
   */
  decrypt(ciphertextWithNonce: Buffer): Buffer {
    const nonceSize = 12;
    if (ciphertextWithNonce.length < nonceSize) {
      throw new Error('ciphertext too short');
    }

    const nonce = ciphertextWithNonce.subarray(0, nonceSize);
    const authTagStart = ciphertextWithNonce.length - 16;
    const encrypted = ciphertextWithNonce.subarray(nonceSize, authTagStart);
    const authTag = ciphertextWithNonce.subarray(authTagStart);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Encrypt and return base64 string.
   */
  encryptToBase64(plaintext: Buffer): string {
    return this.encrypt(plaintext).toString('base64');
  }

  /**
   * Decode base64 and decrypt.
   */
  decryptFromBase64(encoded: string): Buffer {
    const ciphertext = Buffer.from(encoded, 'base64');
    return this.decrypt(ciphertext);
  }

  /**
   * Generate a cryptographically secure random string (base64url encoded).
   */
  generateRandomString(nBytes: number): string {
    return crypto.randomBytes(nBytes).toString('base64url');
  }
}
