import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>('encryptionKey', '');
  }

  /**
   * Encrypt plaintext using AES-256-GCM. Returns buffer with nonce prepended.
   */
  encrypt(plaintext: Buffer): Buffer {
    const key = Buffer.from(this.encryptionKey, 'utf-8');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]);
  }

  /**
   * Decrypt AES-256-GCM ciphertext (nonce prepended).
   */
  decrypt(ciphertext: Buffer): Buffer {
    const key = Buffer.from(this.encryptionKey, 'utf-8');
    const iv = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const encrypted = ciphertext.subarray(12, ciphertext.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * SHA-256 hash a string, return hex-encoded digest.
   */
  sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate cryptographically secure random bytes as hex string.
   */
  randomHex(byteLength: number): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }
}
