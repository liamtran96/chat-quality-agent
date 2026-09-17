import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption service matching the Go backend format.
 * Ciphertext format: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY', '');
    this.key = Buffer.from(encryptionKey, 'utf-8');
  }

  encrypt(plaintext: string): Buffer {
    const nonce = randomBytes(12); // GCM standard nonce size
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Match Go format: nonce + ciphertext + authTag
    return Buffer.concat([nonce, encrypted, authTag]);
  }

  decrypt(ciphertext: Buffer): string {
    const nonceSize = 12;
    const authTagSize = 16;
    if (ciphertext.length < nonceSize + authTagSize) {
      throw new Error('ciphertext too short');
    }
    const nonce = ciphertext.subarray(0, nonceSize);
    const authTag = ciphertext.subarray(ciphertext.length - authTagSize);
    const encrypted = ciphertext.subarray(nonceSize, ciphertext.length - authTagSize);

    const decipher = createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  }
}
